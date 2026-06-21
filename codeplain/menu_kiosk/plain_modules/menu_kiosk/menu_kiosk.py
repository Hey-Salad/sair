import argparse
import os
import sys
import http.client
import json
from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass(frozen=True)
class MenuItem:
    name: str
    category: str
    price: float
    description: str

    def to_dict(self):
        return {
            "name": self.name,
            "category": self.category,
            "price": self.price,
            "description": self.description
        }

# :Menu: hard-coded directly in the source
MENU: List[MenuItem] = [
    MenuItem("House Salad", "Starter", 6.50, "Mixed greens, cherry tomatoes, cucumber, house dressing."),
    MenuItem("Soup of the Day", "Starter", 5.00, "Ask your server what's fresh today."),
    MenuItem("Grain Bowl", "Main", 9.50, "Quinoa, roasted vegetables, chickpeas, tahini dressing."),
    MenuItem("Grilled Chicken Wrap", "Main", 8.00, "Grilled chicken, lettuce, tomato, garlic sauce, warm wrap."),
    MenuItem("Veggie Burger", "Main", 8.50, "House-made veggie patty, brioche bun, pickles, aioli."),
    MenuItem("Fresh Lemonade", "Drink", 3.50, "Squeezed daily, lightly sweetened."),
    MenuItem("Iced Green Tea", "Drink", 3.00, "Unsweetened, served over ice."),
]

def narrate_description(text: str, api_key: str, voice_id: str):
    """Calls ElevenLabs API to synthesize speech and saves to narration.mp3."""
    host = "api.elevenlabs.io"
    path = f"/v1/text-to-speech/{voice_id}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    
    data = json.dumps({
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
    })

    try:
        conn = http.client.HTTPSConnection(host)
        conn.request("POST", path, body=data, headers=headers)
        response = conn.getresponse()

        if response.status != 200:
            error_detail = response.read().decode()
            raise RuntimeError(f"ElevenLabs API error (Status {response.status}): {error_detail}")

        with open("narration.mp3", "wb") as f:
            f.write(response.read())
        
        print("Narration saved to narration.mp3")
        conn.close()
    except Exception as e:
        print(f"Failed to generate narration: {e}", file=sys.stderr)
        sys.exit(1)

def display_item_details(item_name: str, narrate: bool = False, json_output: bool = False):
    """Searches for an item by name and prints its details. Optionally narrates."""
    item = next((i for i in MENU if i.name == item_name), None)
    
    if item:
        narration_status = "none"
        if narrate:
            api_key = os.environ.get("ELEVENLABS_API_KEY")
            voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
            
            if not api_key or not voice_id:
                narration_status = "unavailable"
            else:
                narrate_description(item.description, api_key, voice_id)
                narration_status = "success"

        if json_output:
            result = item.to_dict()
            result["narration_status"] = narration_status
            print(json.dumps(result))
        else:
            print(f"Name: {item.name}")
            print(f"Category: {item.category}")
            print(f"Price: ${item.price:.2f}")
            print(f"Description: {item.description}")
            if narration_status == "unavailable":
                print("Narration is unavailable in this environment (missing API key or Voice ID).")
    else:
        print(f"Error: Item '{item_name}' not found in the menu.", file=sys.stderr)
        sys.exit(1)

def display_menu(json_output: bool = False):
    """Prints the menu grouped by category."""
    categories = ["Starter", "Main", "Drink"]
    grouped: Dict[str, List[MenuItem]] = {cat: [] for cat in categories}
    
    for item in MENU:
        if item.category in grouped:
            grouped[item.category].append(item)
        else:
            # Defensive programming: handle unexpected categories if any
            grouped.setdefault(item.category, []).append(item)

    if json_output:
        json_data = {cat: [i.to_dict() for i in items] for cat, items in grouped.items()}
        print(json.dumps(json_data))
    else:
        for category in grouped:
            if not grouped[category]:
                continue
            print(f"\n--- {category}s ---")
            for item in grouped[category]:
                print(f"{item.name}: ${item.price:.2f}")

def main():
    parser = argparse.ArgumentParser(description="Kiosk Menu Application")
    parser.add_argument("--menu", action="store_true", help="Display the menu grouped by category")
    parser.add_argument("--item", type=str, help="Display details for a specific menu item")
    parser.add_argument("--narrate", action="store_true", help="Synthesize item description to speech")
    parser.add_argument("--json", action="store_true", help="Output result as JSON")
    
    args = parser.parse_args()

    if args.menu:
        display_menu(json_output=args.json)
    elif args.item:
        display_item_details(args.item, narrate=args.narrate, json_output=args.json)
    else:
        parser.print_help()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)