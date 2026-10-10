# Bouwt de Wintercup-app uit src/ en assets/:
#   dist/github/   -> GitHub Pages (kleine index.html + gehashte app/data/luchtfoto, jsPDF los)
#   dist/artifact.html -> één zelfstandig bestand voor de Claude-artifact
# Gebruik: python3 build.py   (draait eerst de unit tests; stopt als die falen)
import json, hashlib, math, os, re, shutil, subprocess, sys
R = os.path.dirname(os.path.abspath(__file__)) + '/'
def run(cmd): r = subprocess.run(cmd, shell=True, cwd=R); r.returncode and sys.exit('mislukt: ' + cmd)
if '--skip-tests' not in sys.argv: run('node --test tests/*.test.js')
ESB = os.path.join(subprocess.check_output('npm root -g', shell=True, text=True).strip(), 'esbuild/bin/esbuild')
run(f'{ESB} src/app.js --bundle --format=iife --target=es2019 --minify --legal-comments=none --log-level=warning --outfile=dist/app.bundle.js')
bundle = open(R + 'dist/app.bundle.js', encoding='utf-8').read()
page = open(R + 'src/page.html', encoding='utf-8').read()
H = lambda b: hashlib.md5(b).hexdigest()[:8]
LAT0, LON0 = 51.74, 3.95; KX = math.cos(math.radians(LAT0)) * 60
img = dict(x=round((3.80 - LON0) * KX, 4), y=round(-(51.815 - LAT0) * KY, 4) if (KY := 60) else 0, width=round(0.38 * KX, 4), height=round(0.16 * KY, 4))
data_raw = json.dumps(json.load(open(R + 'assets/mapdata.json', encoding='utf-8')), separators=(',', ':'))
aerial = open(R + 'assets/aerial.jpg', 'rb').read()
te = page.index('</title>') + 8; title = page[:te]; rest = page[te:]; si = rest.index('</style>') + 8
head_css, html = rest[:si], rest[si:]
esc = lambda s: s.replace('</script', '<\\/script')

# ---------- artifact: alles in één bestand ----------
import base64
img_a = dict(img, href='data:image/jpeg;base64,' + base64.b64encode(aerial).decode())
art = title + head_css + html + '<script>window.__D=' + data_raw + ';window.__IMG=' + json.dumps(img_a) + ';</script>\n<script>' + esc(bundle) + '</script>\n'
open(R + 'dist/artifact.html', 'w', encoding='utf-8').write(art)

# ---------- GitHub Pages ----------
out = R + 'dist/github/'; os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(out + f)
def put(name, ext, b): fn = f'{name}.{H(b)}.{ext}'; open(out + fn, 'wb').write(b); return fn
aer = put('aerial', 'jpg', aerial)
data = put('data', 'json', data_raw.encode())
app = put('app', 'js', ('window.__IMG=' + json.dumps(dict(img, href=aer)) + ';\n' + bundle).encode())
shutil.copy(R + 'assets/jspdf.umd.min.js', out + 'jspdf.umd.min.js')
for f in ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']: shutil.copy(R + 'assets/' + f, out + f)
PWA = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
 '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
 '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Wintercup">\n'
 '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<meta name="theme-color" content="#2f4060">\n'
 f'<link rel="preload" href="{data}" as="fetch" crossorigin>\n<link rel="preload" href="{app}" as="script">\n')
FAIL = 'Laden mislukt. Controleer je verbinding en herlaad.'
BOOT = ('<div id="bootMsg" style="position:fixed;inset:auto 0 0 0;padding:10px;text-align:center;font:600 14px sans-serif;background:#2f4060;color:#fff;z-index:99">Kaart laden…</div>\n'
 '<script>window.__STANDALONE__=true;window.__JSPDF__="jspdf.umd.min.js";\n'
 'if("serviceWorker" in navigator&&location.protocol==="https:"){addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}\n'
 f'function bootFail(){{document.getElementById("bootMsg").textContent="{FAIL}"}}\n'
 f'fetch("{data}").then(function(r){{if(!r.ok)throw 0;return r.json()}}).then(function(j){{window.__D=j;var s=document.createElement("script");s.src="{app}";'
 's.onload=function(){var m=document.getElementById("bootMsg");m&&m.remove()};s.onerror=bootFail;document.body.appendChild(s)}).catch(bootFail);</script>\n')
doc = ('<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
 + PWA + title + head_css + '\n</head>\n<body>\n' + html + BOOT + '</body>\n</html>\n')
open(out + 'index.html', 'w', encoding='utf-8').write(doc)
ver = H((doc + app + data + aer).encode())
sw = open(R + 'src/sw_tpl.js', encoding='utf-8').read().replace('__VER__', ver).replace('__ASSETS__', json.dumps([app, data, aer, 'jspdf.umd.min.js']))
open(out + 'sw.js', 'w', encoding='utf-8').write(sw)
print('artifact', os.path.getsize(R + 'dist/artifact.html'))
for f in sorted(os.listdir(out)): print(' ', f, os.path.getsize(out + f))
