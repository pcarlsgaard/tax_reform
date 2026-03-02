import urllib.request, json, re

def search_fred(query):
    url = 'https://fred.stlouisfed.org/search?st=' + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        # Look for the search result items
        matches = re.findall(r'href="/series/([A-Z0-9_]+)" class="series-title[^>]*>(.*?)</a>', html)
        return [(m[0], m[1]) for m in matches[:5]]
    except Exception as e:
        return str(e)

print('Net interest:', search_fred('Net interest and miscellaneous payments'))
print('Subsidies:', search_fred('Subsidies'))
print('Taxes top:', search_fred('Taxes on production and imports'))
