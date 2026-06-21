#!/usr/bin/env python3
import json
import sys
import os

def generate_reorder_plan(stock_report):
    """
    Processes the StockReport and generates a ReorderPlan.
    """
    reorder_plan = []
    
    for item in stock_report:
        name = item.get("name")
        qty = item.get("estimated_qty")
        status = item.get("status")
        
        # Validation for required fields
        if not all([name, qty, status]):
            raise ValueError(
                f"Invalid StockItem data: Missing required fields in {item}. "
                f"Required: 'name', 'estimated_qty', 'status'."
            )

        if status.lower() in ["low", "critical"]:
            urgency = "high" if status.lower() == "critical" else "medium"
            
            # Ensure name is properly formatted for the suggestion
            display_name = str(name).strip()
            if not display_name:
                raise ValueError(f"Item name cannot be empty or whitespace for item: {item}")

            action = {
                "item": name,
                "reasoning": f"Item '{display_name}' is currently at {status} levels ({qty}).",
                "suggested_order": f"Restock recommendation for {display_name} (Current quantity: {qty})",
                "urgency": urgency
            }
            reorder_plan.append(action)
            
    return reorder_plan

def main():
    # Defensive check for command line arguments
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path_to_stock_report_json>", file=sys.stderr)
        sys.exit(1)
        
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(f"Error: File not found at path: {file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if not isinstance(data, list):
            raise ValueError("Input JSON must be an array of objects.")
            
        plan = generate_reorder_plan(data)
        print(json.dumps(plan, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        print(f"Error: Failed to decode JSON from {file_path}. Details: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()