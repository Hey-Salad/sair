import unittest
from reorder_agent import generate_reorder_plan

class TestReorderLogic(unittest.TestCase):
    def test_empty_report(self):
        self.assertEqual(generate_reorder_plan([]), [])

    def test_status_filtering(self):
        report = [
            {"name": "Apples", "estimated_qty": "10 kg", "status": "ok"},
            {"name": "Milk", "estimated_qty": "1 carton", "status": "critical"},
            {"name": "Bread", "estimated_qty": "2 loaves", "status": "low"}
        ]
        plan = generate_reorder_plan(report)
        self.assertEqual(len(plan), 2)
        self.assertEqual(plan[0]["urgency"], "high")
        self.assertEqual(plan[1]["urgency"], "medium")

    def test_missing_fields(self):
        report = [{"name": "Broken", "status": "low"}]
        with self.assertRaises(ValueError):
            generate_reorder_plan(report)

    def test_critical_status_mapping(self):
        """
        Verify 'critical' status must result in 'high' urgency.
        """
        report = [
            {"name": "Emergency Item", "estimated_qty": "0", "status": "critical"}
        ]
        plan = generate_reorder_plan(report)
        self.assertEqual(plan[0]["urgency"], "high", "Status 'critical' must map to urgency 'high'")

    def test_low_status_mapping(self):
        """
        Verify 'low' status must result in 'medium' urgency.
        """
        report = [
            {"name": "Low Stock Item", "estimated_qty": "5 units", "status": "low"}
        ]
        plan = generate_reorder_plan(report)
        self.assertEqual(plan[0]["urgency"], "medium", "Status 'low' must map to urgency 'medium'")

    def test_ok_status_exclusion(self):
        """
        Verify items with status 'ok' should not generate a ReorderAction.
        """
        report = [
            {"name": "Apples", "estimated_qty": "10 kg", "status": "ok"}
        ]
        plan = generate_reorder_plan(report)
        self.assertEqual(len(plan), 0, "Items with status 'ok' must be excluded from the reorder plan.")

    def test_suggested_order_format(self):
        """
        Verify :codeplain::AdditionalFunctionality::
        Suggested Order must be non-empty and reference the item's name.
        """
        item_name = "Flour"
        report = [{"name": item_name, "estimated_qty": "1 bag", "status": "low"}]
        plan = generate_reorder_plan(report)
        
        suggested_order = plan[0]["suggested_order"]
        self.assertTrue(len(suggested_order) > 0, "Suggested Order must not be empty.")
        self.assertIn(item_name, suggested_order, "Suggested Order must reference the item's name.")

if __name__ == "__main__":
    unittest.main()