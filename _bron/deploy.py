# Bouwt de app en zet de GitHub Pages-bestanden in de root van de repo; daarna committen en pushen.
# Gebruik (vanuit de repo-root):  python3 _bron/deploy.py "v53: korte omschrijving"
#   --no-push   alleen bouwen en de root bijwerken (niet committen/pushen)
# Oude app.<hash>.js / data.<hash>.json / aerial.<hash>.jpg worden opgeruimd; de vorige versie blijft staan
# zodat toestellen met een oude index.html in de cache nog kunnen laden.
import os, re, shutil, subprocess, sys
B = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(B)
args = [a for a in sys.argv[1:] if not a.startswith('--')]; push = '--no-push' not in sys.argv
msg = args[0] if args else None
if push and not msg: sys.exit('Geef een commit-omschrijving mee, bv.: python3 _bron/deploy.py "v53: ..."')
def run(cmd, cwd=ROOT): r = subprocess.run(cmd, shell=True, cwd=cwd); r.returncode and sys.exit('mislukt: ' + cmd)

# vorige versie (uit de huidige index.html) onthouden
prev = set()
if os.path.exists(os.path.join(ROOT, 'index.html')):
    prev = set(re.findall(r'(?:app|data|aerial)\.[0-9a-f]{8}\.(?:js|json|jpg)', open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()))
run('python3 build.py', cwd=B)
out = os.path.join(B, 'dist', 'github')
new = set(os.listdir(out))
for f in new: shutil.copy(os.path.join(out, f), os.path.join(ROOT, f))
keep = new | prev
removed = []
for f in os.listdir(ROOT):
    if re.fullmatch(r'(?:app|data|aerial)\.[0-9a-f]{8}\.(?:js|json|jpg)', f) and f not in keep:
        os.remove(os.path.join(ROOT, f)); removed.append(f)
print('bijgewerkt:', ', '.join(sorted(new)))
if removed: print('opgeruimd:', ', '.join(sorted(removed)))
if push:
    run('git add -A')
    if subprocess.run('git diff --cached --quiet', shell=True, cwd=ROOT).returncode == 0: print('niets te committen'); sys.exit(0)
    if subprocess.run(['git', 'commit', '-q', '-m', msg], cwd=ROOT).returncode: sys.exit('mislukt: git commit')
    run('git push -q origin HEAD:main')
    print('gepusht naar main; GitHub Pages werkt de site binnen ~1 minuut bij.')
