import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from agent_coordinator import route_task
from app import AssistRequest, build_messages, multi_agent_provider_configured, provider_configured
from knowledge_store import delete_document, save_document, search_documents
from multi_agent_runtime import select_specialists
from httpx import ASGITransport, AsyncClient
from app import app



class ProviderConfigurationTests(unittest.TestCase):
    def test_single_model_readiness_requires_shared_endpoint(self):
        with patch.dict(os.environ, {"LMLM_MODEL_BASE_URL": "", "LMLM_RESEARCH_BASE_URL": "http://research"}, clear=False):
            self.assertFalse(provider_configured())

    def test_multi_agent_readiness_requires_specialist_and_synthesis(self):
        with patch.dict(os.environ, {
            "LMLM_MODEL_BASE_URL": "",
            "LMLM_RESEARCH_BASE_URL": "http://research",
            "LMLM_SYNTHESIS_BASE_URL": "",
        }, clear=False):
            self.assertFalse(multi_agent_provider_configured())

    def test_multi_agent_readiness_accepts_role_specific_endpoints(self):
        with patch.dict(os.environ, {
            "LMLM_MODEL_BASE_URL": "",
            "LMLM_RESEARCH_BASE_URL": "http://research",
            "LMLM_SYNTHESIS_BASE_URL": "http://synthesis",
        }, clear=False):
            self.assertTrue(multi_agent_provider_configured())


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


class MultiAgentExecutionTests(unittest.IsolatedAsyncioTestCase):
    @patch.dict(os.environ, {"LMLM_MODEL_BASE_URL": "http://127.0.0.1:1234/v1", "LMLM_RESEARCH_MODEL": "research-local", "LMLM_ENGINEERING_MODEL": "coder-local", "LMLM_SECURITY_MODEL": "security-local", "LMLM_SYNTHESIS_MODEL": "synthesis-local"})
    @patch("multi_agent_runtime._chat", new_callable=AsyncMock)
    async def test_specialists_run_and_synthesis_returns_text_only_result(self, mock_chat):
        from multi_agent_runtime import execute_specialists

        observed_models = []

        async def fake_chat(_client, _endpoint, _headers, model, messages):
            observed_models.append(model)
            system = messages[0]["content"]
            if "synthesis coordinator" in system:
                return "Combined findings."
            return "Specialist findings."

        mock_chat.side_effect = fake_chat
        plan = route_task("Research and implement a secure browser runtime")
        result = await execute_specialists(
            "Research and implement a secure browser runtime",
            [{"role": "system", "content": "System"}, {"role": "user", "content": "Task"}],
            plan,
        )
        self.assertEqual(result["answer"], "Combined findings.")
        self.assertEqual(result["execution_mode"], "bounded_multi_agent_inference")
        self.assertEqual(len(result["agent_results"]), 3)
        self.assertEqual(mock_chat.await_count, 4)
        self.assertCountEqual(
            observed_models,
            ["research-local", "coder-local", "security-local", "synthesis-local"],
        )
        self.assertEqual(result["tools_invoked"], [])
        self.assertFalse(result["browser_actions_performed"])



class LocalIpcAuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def test_v1_routes_require_configured_bearer_token(self):
        with patch.dict(os.environ, {"LMLM_IPC_TOKEN": "test-secret-token"}):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                denied = await client.post("/v1/agents/plan", json={"prompt": "test"})
                allowed = await client.post(
                    "/v1/agents/plan",
                    json={"prompt": "test"},
                    headers={"Authorization": "Bearer test-secret-token"},
                )
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(allowed.status_code, 200)

    async def test_v1_routes_fail_closed_without_token_configuration(self):
        with patch.dict(os.environ, {"LMLM_IPC_TOKEN": ""}):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post("/v1/agents/plan", json={"prompt": "test"})
        self.assertEqual(response.status_code, 503)

if __name__ == "__main__":
    unittest.main()
