import os
import tempfile
import unittest
from unittest.mock import patch

from agent_coordinator import route_task
from knowledge_store import delete_document, save_document, search_documents


class KnowledgeStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"LMLM_DATA_DIR": self.temp_dir.name})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp_dir.cleanup()

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


if __name__ == "__main__":
    unittest.main()
