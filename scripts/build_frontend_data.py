import os
import json
import glob

def extract_blocks_from_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if not data or not isinstance(data, list):
                return []
            
            blocks = []
            for block in data:
                if not isinstance(block, dict):
                    continue
                
                # Total Extractable Resource
                extractable = float((block.get('totalGWAvailability') or {}).get('total') or 0.0)
                
                # Extraction (Draft Data)
                draft_data = block.get('draftData') or {}
                extraction_agg = 0.0
                if isinstance(draft_data, dict):
                    # Try total draft
                    total_draft = draft_data.get('total')
                    if isinstance(total_draft, dict):
                        extraction_agg = float(total_draft.get('total') or 0.0)
                    elif isinstance(total_draft, (int, float)):
                        extraction_agg = float(total_draft)
                    
                    # If total is still 0, aggregate from sectors
                    if extraction_agg == 0:
                        for sector in ['agriculture', 'domestic', 'industry']:
                            s_data = draft_data.get(sector)
                            if isinstance(s_data, dict):
                                extraction_agg += float(s_data.get('total') or s_data.get('non_command') or 0.0)
                            elif isinstance(s_data, (int, float)):
                                extraction_agg += float(s_data)

                # Fallback to computationSummary if draftData wasn't present
                if extraction_agg == 0:
                    comp_summary = block.get('computationSummary') or {}
                    annual_data = comp_summary.get('annual') or {}
                    draft = annual_data.get('draft') or {}
                    if isinstance(draft, dict):
                        for sector in ['agriculture', 'domestic', 'industry']:
                            sector_dec = (draft.get(sector) or {}).get('decision') or {}
                            sector_data = sector_dec.get('non_command') or {}
                            extraction_agg += float(sector_data.get('u_dr') or 0.0)
                
                # Stage of extraction
                stage = 0.0
                stage_obj = block.get('stageOfExtraction') or {}
                if isinstance(stage_obj, dict):
                    stage = float(stage_obj.get('total') or stage_obj.get('non_command') or 0.0)
                elif isinstance(stage_obj, (int, float)):
                    stage = float(stage_obj)
                
                if stage == 0.0 and extractable > 0 and extraction_agg > 0:
                    stage = (extraction_agg / extractable) * 100.0

                # If stage was found but extraction_agg was 0, calculate extraction
                if extraction_agg == 0.0 and stage > 0 and extractable > 0:
                    extraction_agg = (stage / 100.0) * extractable
                
                # Category
                category_obj = block.get('category') or {}
                category = 'unknown'
                if isinstance(category_obj, dict):
                    category = str(category_obj.get('total') or category_obj.get('non_command') or 'unknown')
                elif isinstance(category_obj, str):
                    category = category_obj
                
                # Rainfall
                rainfall_obj = block.get('rainfall') or {}
                rainfall = 0.0
                if isinstance(rainfall_obj, dict):
                    rainfall = float(rainfall_obj.get('total') or 0.0)
                elif isinstance(rainfall_obj, (int, float)):
                    rainfall = float(rainfall_obj)

                blocks.append({
                    "name": block.get('locationName', 'Unknown'),
                    "uuid": block.get('locationUUID', ''),
                    "extractable_ham": round(extractable, 2),
                    "extraction_ham": round(extraction_agg, 2),
                    "stage": round(stage, 2),
                    "category": category.lower(),
                    "rainfall": round(rainfall, 2)
                })
            return blocks
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return []

def build_master_dataset():
    data_root = "Data/data"
    years = ["2023-2024", "2024-2025"]
    
    master_data = {}
    
    for year in years:
        year_path = os.path.join(data_root, year)
        if not os.path.exists(year_path):
            continue
            
        print(f"Processing Year: {year}...")
        master_data[year] = []
        
        # Use glob to find all files recursively
        pattern = os.path.join(year_path, "**/*.json")
        files = glob.glob(pattern, recursive=True)
        
        for file_path in files:
            filename = os.path.basename(file_path).lower()
            if filename in ["total.json", "summary.json"]:
                continue
                
            file_blocks = extract_blocks_from_file(file_path)
            
            if file_blocks:
                path_parts = os.path.normpath(file_path).split(os.sep)
                
                state_name = "Unknown"
                district_name = "Unknown"

                if len(path_parts) >= 6:
                    state_name = path_parts[3]
                    district_name = path_parts[4]
                elif len(path_parts) == 5:
                    state_name = path_parts[3]
                    district_name = os.path.splitext(path_parts[4])[0]
                elif len(path_parts) == 4: 
                    state_name = os.path.splitext(path_parts[3])[0]
                    district_name = state_name
                
                for b in file_blocks:
                    b["state"] = state_name
                    current_district = b.get("district", "Unknown")
                    if current_district == "Unknown":
                        b["district"] = district_name
                    elif district_name != "Unknown":
                        b["district"] = district_name
                             
                    master_data[year].append(b)
        
        non_zero_stages = sum(1 for b in master_data[year] if b.get('stage', 0) > 0)
        print(f"  Extracted {len(master_data[year])} blocks for {year} (Blocks with non-zero stage: {non_zero_stages})")

    output_path = "src/data/groundwater_dataset.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2)
    
    print(f"Successfully saved master dataset to {output_path}")

if __name__ == "__main__":
    build_master_dataset()
