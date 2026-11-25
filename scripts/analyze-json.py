import json
import sys

with open('selected_character_prompts(1).json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("JSON根级字段:")
for key in data.keys():
    print(f"  - {key}")

print(f"\n角色数量: {len(data.get('characters', []))}")

if 'characters' in data and len(data['characters']) > 0:
    print("\n第一个角色的所有字段:")
    char = data['characters'][0]
    for key, value in char.items():
        if isinstance(value, str):
            print(f"  - {key}: string ({len(value)} 字符)")
        elif isinstance(value, list):
            print(f"  - {key}: array ({len(value)} 项)")
        elif isinstance(value, dict):
            print(f"  - {key}: object ({len(value)} 个子字段)")
            for subkey in value.keys():
                print(f"      * {subkey}")
        else:
            print(f"  - {key}: {type(value).__name__}")
