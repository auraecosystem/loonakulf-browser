import os
import tempfile
import unittest
from unittest.mock import patch

from agent_coordinator import route_task
from app import AssistRequest, build_messages
from knowledge_store import delete_document, save_document, search_documents
from multi_agent_runtime import select_specialists


class KnowledgeStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"LMLM_DATA_DIR": self.temp_dir.name})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp_dir.cleanup()

    def test_assistant_retrieves_saved_content_only_when_opted_in(self):
        save_document(
            "Privacy reference",
            "https://example.test/privacy",
            "Browser permission privacy should be controlled by the user.",
        )
        enabled = build_messages(AssistRequest(prompt="permission privacy", use_knowledge=True))
        disabled = build_messages(AssistRequest(prompt="permission privacy", use_knowledge=False))
        self.assertIn("LOCAL KNOWLEDGE RESULTS", enabled[1]["content"])
        self.assertNotIn("LOCAL KNOWLEDGE RESULTS", disabled[1]["content"])

    def test_explicitly_saved_document_can_be_searched_and_deleted(self):
        saved = save_document(
            "Browser security notes",
            "https://example.test/security",
            "Loonakulf browser uses permission controls and local privacy boundaries.",
        )
        results = search_documents("permission privacy")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], saved["id"])
        self.assertTrue(delete_document(saved["id"]))
        self.assertEqual(search_documents("permission privacy"), [])


class AgentCoordinatorTests(unittest.TestCase):
    def test_routes_engineering_and_security_roles_without_tools(self):
        plan = route_task("Implement and test a secure browser runtime")
        names = [agent["id"] for agent in plan["selected_agents"]]
        self.assertIn("engineering", names)
        self.assertIn("security", names)
        self.assertEqual(plan["execution_mode"], "plan_only")
        self.assertEqual(plan["tools_invoked"], [])
        self.assertTrue(plan["requires_user_approval_for_actions"])


class MultiAgentRuntimeTests(unittest.TestCase):
    def test_specialist_selection_is_bounded_and_always_includes_security(self):
        plan = route_task("Research and implement a secure browser runtime")
        selected = select_specialists(plan)
        names = [agent["id"] for agent in selected]
        self.assertLessEqual(len(selected), 3)
        self.assertIn("security", names)
        self.assertEqual(len(names), len(set(names)))

    def test_unknown_agent_roles_are_not_executed(self):
        selected = select_specialists({"selected_agents": [{"id": "shell"}, {"id": "security"}]})
        self.assertEqual([agent["id"] for agent in selected], ["security"])


if __name__ == "__main__":
    unittest.main()
