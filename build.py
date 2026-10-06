#!/usr/bin/env python3
"""Assemble src/* en www/index.html (fichier unique, sans dépendance)."""
import os
r = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda p: open(os.path.join(r, p), encoding='utf8').read()
js = rd('src/data.js') + '\n' + rd('src/lib.js') + '\n' + rd('src/app.js')
html = rd('src/index.tpl.html').replace('/*CSS*/', rd('src/style.css')).replace('/*JS*/', js.replace('</script', '<\\/script'))
open(os.path.join(r, 'www/index.html'), 'w', encoding='utf8').write(html)
print('www/index.html', len(html), 'octets')
