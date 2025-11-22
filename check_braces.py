import re

p = 'index.html'
text = open(p, 'r', encoding='utf-8').read()
# extract first <script> ... </script>
m = re.search(r'<script[^>]*>([\s\S]*?)</script>', text, flags=re.IGNORECASE)
if not m:
    print('No <script> block found')
    raise SystemExit(1)
script = m.group(1)

lines = script.splitlines()

# remove comments
# remove /* */
script_nocomments = re.sub(r'/\*[\s\S]*?\*/', lambda s: '\n' * s.group(0).count('\n'), script)
# remove // till end of line
script_nocomments = re.sub(r'//.*', '', script_nocomments)

# remove single and double quoted strings and backticks (replace with spaces preserving newlines)
def mask_strings(s):
    out = []
    i = 0
    L = len(s)
    while i < L:
        c = s[i]
        if c in "'\"`":
            quote = c
            out.append(' ')
            i += 1
            escaped = False
            while i < L:
                ch = s[i]
                out.append(' ')
                if ch == '\\' and not escaped:
                    escaped = True
                elif ch == quote and not escaped:
                    i += 1
                    break
                else:
                    escaped = False
                i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)

masked = mask_strings(script_nocomments)

# now scan for braces and report unexpected closing brace locations
brace = 0
paren = 0
brack = 0
line_no = 1
col = 0
for idx, ch in enumerate(masked):
    if ch == '\n':
        line_no += 1
        col = 0
        continue
    col += 1
    if ch == '{':
        brace += 1
    elif ch == '}':
        if brace == 0:
            # find context
            context_start = max(0, idx-40)
            context_end = min(len(masked), idx+40)
            context = masked[context_start:context_end]
            print(f"Unexpected '}}' at line {line_no} col {col}")
            print('Context:\n', context)
            raise SystemExit(0)
        brace -= 1
    elif ch == '(':
        paren += 1
    elif ch == ')':
        if paren == 0:
            print(f"Unexpected ')' at line {line_no} col {col}")
            raise SystemExit(0)
        paren -= 1
    elif ch == '[':
        brack += 1
    elif ch == ']':
        if brack == 0:
            print(f"Unexpected ']' at line {line_no} col {col}")
            raise SystemExit(0)
        brack -= 1

print('Finished scan. counts -> {brace,paren,brack}:', brace, paren, brack)
if brace != 0 or paren != 0 or brack != 0:
    print('Unbalanced braces detected')
else:
    print('No unexpected closing brace found')
