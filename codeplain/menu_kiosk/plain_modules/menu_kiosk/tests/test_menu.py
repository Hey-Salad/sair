import unittest
import io
import os
import json
from unittest.mock import patch, MagicMock
from contextlib import redirect_stdout
from menu_kiosk import MENU, MenuItem, display_menu, display_item_details

class TestMenuKiosk(unittest.TestCase):
    def test_menu_content(self):
        """Verify that the menu contains exactly the required items."""
        self.assertEqual(len(MENU), 7, "Menu should contain exactly 7 items.")
        
        # Spot check specific items
        burger = next((item for item in MENU if item.name == "Veggie Burger"), None)
        self.assertIsNotNone(burger)
        self.assertEqual(burger.category, "Main")
        self.assertEqual(burger.price, 8.50)

    def test_display_menu_output(self):
        """Verify that the display_menu function prints categories and items."""
        f = io.StringIO()
        with redirect_stdout(f):
            display_menu()
        output = f.getvalue()
        
        self.assertIn("--- Starters ---", output)
        self.assertIn("--- Mains ---", output)
        self.assertIn("--- Drinks ---", output)
        self.assertIn("House Salad: $6.50", output)
        self.assertIn("Iced Green Tea: $3.00", output)

    def test_menu_item_immutability(self):
        """Ensure MenuItem attributes are protected."""
        item = MENU[0]
        with self.assertRaises(AttributeError):
            item.price = 10.00 # Frozen dataclass

    def test_display_item_details_success(self):
        """Verify output for a valid item lookup."""
        f = io.StringIO()
        with redirect_stdout(f):
            display_item_details("Veggie Burger")
        output = f.getvalue()
        self.assertIn("Name: Veggie Burger", output)
        self.assertIn("Category: Main", output)
        self.assertIn("Price: $8.50", output)
        self.assertIn("Description: House-made veggie patty", output)

    def test_display_item_details_not_found(self):
        """Verify error handling for an invalid item lookup."""
        with self.assertRaises(SystemExit) as cm:
            display_item_details("Non-Existent Item")
        self.assertEqual(cm.exception.code, 1)

    @patch("menu_kiosk.http.client.HTTPSConnection")
    @patch.dict(os.environ, {"ELEVENLABS_API_KEY": "fake_key", "ELEVENLABS_VOICE_ID": "fake_voice"})
    def test_narration_success(self, mock_conn):
        """Test successful narration trigger and API call simulation."""
        # Setup mock response
        mock_instance = mock_conn.return_value
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b"fake_mp3_data"
        mock_instance.getresponse.return_value = mock_response

        # Mock open to avoid writing to disk during test
        with patch("builtins.open", unittest.mock.mock_open()) as mocked_file:
            f = io.StringIO()
            with redirect_stdout(f):
                display_item_details("Fresh Lemonade", narrate=True)
            
            output = f.getvalue()
            self.assertIn("Narration saved to narration.mp3", output)
            mocked_file.assert_called_once_with("narration.mp3", "wb")
            mocked_file().write.assert_called_once_with(b"fake_mp3_data")

    @patch.dict(os.environ, {}, clear=True)
    def test_narration_missing_env_vars(self):
        """Verify graceful degradation if narration requested without API keys."""
        f = io.StringIO()
        with redirect_stdout(f):
            # Should not raise SystemExit
            display_item_details("Fresh Lemonade", narrate=True)
        
        output = f.getvalue()
        self.assertIn("Narration is unavailable in this environment", output)

    def test_display_menu_json(self):
        """Verify JSON output for the menu."""
        f = io.StringIO()
        with redirect_stdout(f):
            display_menu(json_output=True)
        
        data = json.loads(f.getvalue())
        self.assertIn("Starter", data)
        self.assertIn("Main", data)
        self.assertIn("Drink", data)
        self.assertEqual(data["Starter"][0]["name"], "House Salad")

    def test_display_item_details_json(self):
        """Verify JSON output for item details."""
        f = io.StringIO()
        with redirect_stdout(f):
            display_item_details("Veggie Burger", json_output=True)
        
        data = json.loads(f.getvalue())
        self.assertEqual(data["name"], "Veggie Burger")
        self.assertEqual(data["price"], 8.50)
        self.assertEqual(data["narration_status"], "none")

if __name__ == "__main__":
    unittest.main()