import sys
import os

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Target pattern for the status badge
    # We want to find the TouchableOpacity that has the handleUpdateEstado and change it to a View
    
    import re
    
    # Regex to find the TouchableOpacity block for the status badge
    # It usually looks like:
    # <TouchableOpacity 
    #     onPress={() => handleUpdateEstado(gasto)}
    #     style={[styles.estadoBadge, ...]}
    # >
    # ...
    # </TouchableOpacity>
    
    pattern = r'<TouchableOpacity\s*\n\s*onPress=\{\(\)\s*=>\s*handleUpdateEstado\(gasto\)\}\s*\n\s*style=\{\[styles\.estadoBadge'
    replacement = r'<View \n                                                         style={[styles.estadoBadge'
    
    new_content = re.sub(pattern, replacement, content)
    
    # Now fix the closing tag. This is tricky because there are many </TouchableOpacity>
    # We'll search for the </TouchableOpacity> that follows a </Text> within a few lines of estadoBadge
    # Actually, a better way is to replace the specific block.
    
    # Let's try a more specific full block replacement for one file to test
    
    return new_content

def fix_all():
    screens = [
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/ProduccionGastosScreen.js",
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/MantenimientoGastosScreen.js",
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/TalleresGastosScreen.js",
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/GHGastosScreen.js",
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/SSTGastosScreen.js",
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/PlaneacionGastosScreen.js",
        "g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/DisenoGastosScreen.js"
    ]
    
    for screen in screens:
        if os.path.exists(screen):
            print(f"Fixing {screen}...")
            with open(screen, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # More robust regex that handles the whole block
            # Matches <TouchableOpacity ... onPress={...handleUpdateEstado...} ...> ... </TouchableOpacity>
            pattern = r'(<TouchableOpacity\s+[^>]*onPress=\{\(\)\s*=>\s*handleUpdateEstado\(gasto\)\}[^>]*>)(.*?)(</TouchableOpacity>)'
            
            def replacer(match):
                header = match.group(1)
                body = match.group(2)
                footer = match.group(3)
                
                # Remove onPress and change tag to View
                new_header = re.sub(r'onPress=\{\(\)\s*=>\s*handleUpdateEstado\(gasto\)\}', '', header)
                new_header = new_header.replace('TouchableOpacity', 'View')
                new_footer = footer.replace('TouchableOpacity', 'View')
                
                return new_header + body + new_footer

            new_content = re.sub(pattern, replacer, content, flags=re.DOTALL)
            
            if new_content != content:
                with open(screen, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print("Done.")
            else:
                print("No change needed or pattern not found.")

if __name__ == "__main__":
    fix_all()
