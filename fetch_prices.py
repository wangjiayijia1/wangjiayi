# -*- coding: utf-8 -*-
"""
Taihua New Materials Price Board - Price Fetcher
Data source: 100ppi.com (vane + subsite)
Output: data.json (consumed by index.html)

Auto-fetched products (13/13):
  Vane:       benzene(120), cyclohexanone(742), nitric-acid(723), adipic-acid(837),
              hydrogen-peroxide(758), ammonium-sulfate(741), sulfuric-acid(236),
              sulfur(427), ammonia(965), cyclohexane(1364)
  Subsite:    CPL(cpl.100ppi.com), PA6(pa6.100ppi.com)

Removed (no data source on 100ppi.com):
  nicotine, raw-coal, fuel-coal, cyclohexanol, hydrogen, natural-gas
"""

import json
import re
import os
import sys
import time
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ==================== Config ====================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "data.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

MOBILE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

MOBILE_VANE_NAMES = {
    120: "\u7eaf\u82ef",
    742: "\u73af\u5df1\u916e",
    723: "\u785d\u9178",
    837: "\u5df1\u4e8c\u9178",
    758: "\u53cc\u6c27\u6c34",
    741: "\u786b\u94f5",
    236: "\u786b\u9178",
    427: "\u786b\u78fa",
    965: "\u6db2\u6c28",
    1364: "\u73af\u5df1\u70f7",
}

# Vane sources (stable URL)
VANE_SOURCES = {
    "\u7eaf\u82ef": {"url": "https://www.100ppi.com/vane/detail-120.html", "vid": 120},
    "\u73af\u5df1\u916e": {
        "url": "https://www.100ppi.com/vane/detail-742.html",
        "vid": 742,
    },
    "\u785d\u9178": {"url": "https://www.100ppi.com/vane/detail-723.html", "vid": 723},
    "\u5df1\u4e8c\u9178": {
        "url": "https://www.100ppi.com/vane/detail-837.html",
        "vid": 837,
    },
    "\u53cc\u6c27\u6c34": {
        "url": "https://www.100ppi.com/vane/detail-758.html",
        "vid": 758,
    },
    "\u786b\u94f5": {"url": "https://www.100ppi.com/vane/detail-741.html", "vid": 741},
    "\u786b\u9178": {"url": "https://www.100ppi.com/vane/detail-236.html", "vid": 236},
    "\u786b\u78fa": {"url": "https://www.100ppi.com/vane/detail-427.html", "vid": 427},
    "\u6db2\u6c28": {"url": "https://www.100ppi.com/vane/detail-965.html", "vid": 965},
    "\u73af\u5df1\u70f7": {
        "url": "https://www.100ppi.com/vane/detail-1364.html",
        "vid": 1364,
    },
    # proxy: synthetic ammonia uses liquid ammonia data
    "\u5408\u6210\u6c28": {
        "url": "https://www.100ppi.com/vane/detail-965.html",
        "vid": 965,
        "proxy_for": "\u6db2\u6c28",
    },
}

# Subsite sources (stable URL)
SUBSITE_SOURCES = {
    "\u5df1\u5185\u9170\u80fa": {
        "url": "https://cpl.100ppi.com/",
        "keyword": "\u5df1\u5185\u9170\u80fa",
        "ppid": 1249,
    },
    "\u5c3c\u9f996\u5207\u7247": {
        "url": "https://pa6.100ppi.com/",
        "keyword": "PA6",
        "ppid": 102,
    },
}

# Product metadata
PRODUCT_META = {
    "\u5df1\u5185\u9170\u80fa": {
        "formula": "C6H11NO",
        "unit": "\u5143/\u5428",
        "tag": "product",
    },
    "\u5df1\u4e8c\u9178": {
        "formula": "C6H10O4",
        "unit": "\u5143/\u5428",
        "tag": "product",
    },
    "\u5c3c\u9f996\u5207\u7247": {
        "formula": "(C6H11NO)n",
        "unit": "\u5143/\u5428",
        "tag": "product",
    },
    "\u5408\u6210\u6c28": {"formula": "NH3", "unit": "\u5143/\u5428", "tag": "product"},
    "\u785d\u9178": {"formula": "HNO3", "unit": "\u5143/\u5428", "tag": "product"},
    "\u53cc\u6c27\u6c34": {
        "formula": "H2O2",
        "unit": "\u5143/\u5428",
        "tag": "product",
    },
    "\u786b\u9178": {"formula": "H2SO4", "unit": "\u5143/\u5428", "tag": "product"},
    "\u6db2\u6c28": {"formula": "NH3(l)", "unit": "\u5143/\u5428", "tag": "product"},
    "\u786b\u94f5": {"formula": "(NH4)2SO4", "unit": "\u5143/\u5428", "tag": "product"},
    "\u7eaf\u82ef": {"formula": "C6H6", "unit": "\u5143/\u5428", "tag": "raw"},
    "\u786b\u78fa": {"formula": "S", "unit": "\u5143/\u5428", "tag": "raw"},
    "\u73af\u5df1\u916e": {"formula": "C6H10O", "unit": "\u5143/\u5428", "tag": "mid"},
    "\u73af\u5df1\u70f7": {"formula": "C6H12", "unit": "\u5143/\u5428", "tag": "mid"},
}

PRODUCTS_ORDER = [
    "\u5df1\u5185\u9170\u80fa",
    "\u5df1\u4e8c\u9178",
    "\u5c3c\u9f996\u5207\u7247",
    "\u5408\u6210\u6c28",
    "\u785d\u9178",
    "\u53cc\u6c27\u6c34",
    "\u786b\u9178",
    "\u6db2\u6c28",
    "\u786b\u94f5",
]
RAW_MATERIALS_ORDER = ["\u7eaf\u82ef", "\u786b\u78fa"]
INTERMEDIATES_ORDER = ["\u73af\u5df1\u916e", "\u73af\u5df1\u70f7"]

# Profit line: product price key -> price name in fetched data
PROFIT_LINE_PRICE_MAP = {
    "\u5df1\u5185\u9170\u80fa": "\u5df1\u5185\u9170\u80fa",
    "\u5df1\u4e8c\u9178": "\u5df1\u4e8c\u9178",
    "\u5c3c\u9f996\u5207\u7247": "\u5c3c\u9f996\u5207\u7247",
    "\u73af\u5df1\u916e(\u5916\u552e)": "\u73af\u5df1\u916e",
    "\u5408\u6210\u6c28": "\u5408\u6210\u6c28",
    "\u53cc\u6c27\u6c34": "\u53cc\u6c27\u6c34",
    "\u785d\u9178": "\u785d\u9178",
}

# Profit line: raw material label -> price name (None = keep static)
PROFIT_LINE_RAW_MAP = {
    "\u5df1\u5185\u9170\u80fa": [("\u7eaf\u82ef", "\u7eaf\u82ef")],
    "\u5df1\u4e8c\u9178": [
        ("\u7eaf\u82ef", "\u7eaf\u82ef"),
        ("\u785d\u9178", "\u785d\u9178"),
    ],
    "\u5c3c\u9f996\u5207\u7247": [
        ("\u5df1\u5185\u9170\u80fa", "\u5df1\u5185\u9170\u80fa")
    ],
    "\u73af\u5df1\u916e(\u5916\u552e)": [("\u7eaf\u82ef", "\u7eaf\u82ef")],
    "\u5408\u6210\u6c28": [("\u539f\u6599\u7164", None)],
    "\u53cc\u6c27\u6c34": [],
    "\u785d\u9178": [("\u6db2\u6c28", "\u6db2\u6c28")],
}

# Static profit line data (plant info, consumption, etc.)
PROFIT_LINES = [
    {
        "name": "\u5df1\u5185\u9170\u80fa",
        "productPrice": 12013,
        "threshold": 2000,
        "rawMaterials": [
            {"label": "\u7eaf\u82ef", "qty": 1.0, "unit": "\u5428", "price": 7434}
        ],
        "h2Qty": 250,
        "steamQty": 5,
        "powerQty": 400,
        "otherCost": 800,
        "byproduct": 880,
        "byproductLabel": "\u526f\u4ea7\u786b\u94f5\u56de\u6536",
        "spreadLabel": "\u5df1\u5185\u9170\u80fa-\u7eaf\u82ef",
        "plant": {
            "capacity": "30\u4e07\u5428/\u5e74",
            "unitName": "\u9170\u80fa\u88c5\u7f6e\uff08A\u7ebf20\u4e07+C\u7ebf10\u4e07\uff09",
            "status": "A\u7ebf2026\u5e743\u6708\u6280\u6539\u8fbe\u4ea7\u8fbe\u6548\uff0c\u84b8\u6c7d\u5355\u8017\u964d50%\uff0c\u65e5\u4ea7\u91cf670\u5428/\u5929",
            "advantage": "\u5355\u7ebf\u4ea7\u80fd\u56fd\u5185\u9886\u5148\uff0c\u6280\u6539\u540e\u80fd\u8037\u8fbe\u56fd\u5185\u5148\u8fdb\u6c34\u5e73\uff0c\u526f\u4ea7\u786b\u94f5\u56de\u6536\u964d\u672c",
        },
    },
    {
        "name": "\u5df1\u4e8c\u9178",
        "productPrice": 8250,
        "threshold": 500,
        "rawMaterials": [
            {"label": "\u7eaf\u82ef", "qty": 0.70, "unit": "\u5428", "price": 7434},
            {"label": "\u785d\u9178", "qty": 0.65, "unit": "\u5428", "price": 1327},
        ],
        "h2Qty": 60,
        "steamQty": 6,
        "powerQty": 500,
        "otherCost": 400,
        "byproduct": 0,
        "spreadLabel": "\u5df1\u4e8c\u9178-\u7eaf\u82ef",
        "plant": {
            "capacity": "14\u4e07\u5428/\u5e74",
            "unitName": "\u5df1\u4e8c\u9178\u88c5\u7f6e",
            "status": "2024\u5e74\u4ea7\u91cf\u521b\u6295\u4ea7\u65b0\u9ad8\uff0c\u4e00\u5b63\u5ea6\u6ee1\u8d1f\u8377\u8fd0\u884c",
            "advantage": "\u4f59\u70ed\u53d1\u7535\u9879\u76ee\u914d\u5957\u5df1\u4e8c\u9178\u88c5\u7f6e\u533a\uff0c\u84b8\u6c7d\u51b7\u51dd\u6db2\u4f59\u70ed\u56de\u6536\u964d\u672c\u589e\u6548",
        },
    },
    {
        "name": "\u5c3c\u9f996\u5207\u7247",
        "productPrice": 13300,
        "threshold": 500,
        "rawMaterials": [
            {
                "label": "\u5df1\u5185\u9170\u80fa",
                "qty": 1.01,
                "unit": "\u5428",
                "price": 12013,
            }
        ],
        "h2Qty": 0,
        "steamQty": 1.5,
        "powerQty": 350,
        "otherCost": 200,
        "byproduct": 0,
        "spreadLabel": "\u5c3c\u9f996-\u5df1\u5185\u9170\u80fa",
        "plant": {
            "capacity": "10\u4e07\u5428/\u5e74\uff08\u9884\u8ba1\u53ef\u8fbe11\u4e07\u5428\uff09",
            "unitName": "\u5c3c\u9f99\u88c5\u7f6e\uff08A\u7ebf7\u4e07+C\u7ebf3\u4e07\uff09",
            "status": "\u65e5\u4ea7\u80fd310\u5428\uff0c\u81ea\u63a7\u56de\u8def\u548c\u8fde\u9501\u6295\u7528\u7387100%\uff0c\u4e00\u952e\u505c\u8f66\u7cfb\u7edf\u6295\u8fd0",
            "advantage": "\u4e2d\u7c98\u6709\u5149\u5e38\u89c4\u7eba\u5207\u7247\uff0c\u7528\u4e8e\u5de5\u7a0b\u5851\u6599\u548c\u6c11\u7528\u77ed\u7ea4\uff0c\u8fb9\u9645\u8d21\u732e\u6700\u5927\u7684\u4ea7\u54c1",
        },
    },
    {
        "name": "\u73af\u5df1\u916e(\u5916\u552e)",
        "productPrice": 8700,
        "threshold": 500,
        "rawMaterials": [
            {"label": "\u7eaf\u82ef", "qty": 0.95, "unit": "\u5428", "price": 7434}
        ],
        "h2Qty": 350,
        "steamQty": 4,
        "powerQty": 300,
        "otherCost": 300,
        "byproduct": 0,
        "spreadLabel": "\u73af\u5df1\u916e-\u7eaf\u82ef",
        "plant": {
            "capacity": "\u9187\u916e\u88c5\u7f6e\uff08C\u7ebf\u6539\u9020\u540e\u65e5\u5747\u73af\u5df1\u9187307\u5428\uff09",
            "unitName": "\u73af\u5df1\u9187\u916e\u88c5\u7f6e\uff08A\u7ebf/E\u7ebf/C\u7ebf\uff09",
            "status": "C\u7ebf\u5b8c\u6210\u5206\u79bb\u5854\u5185\u4ef6\u6539\u9020\uff0c\u6ee1\u8d1f\u8377\u8fd0\u884c\uff0c2024\u5e74\u73af\u5df1\u916e\u4ea7\u91cf\u540c\u6bd4\u589e10.93%",
            "advantage": "\u5428\u73af\u5df1\u916e\u82ef\u8017\u964d0.1\u5428\uff0c\u84b8\u6c7d\u964d0.5\u5428\uff0c\u6c22\u6c14\u964d50Nm\u00b3\uff0c\u8fd4\u82ef\u7eaf\u5ea699.9%",
        },
    },
    {
        "name": "\u5408\u6210\u6c28",
        "productPrice": 2180,
        "threshold": 400,
        "rawMaterials": [
            {"label": "\u539f\u6599\u7164", "qty": 1.3, "unit": "\u5428", "price": 920}
        ],
        "h2Qty": 0,
        "steamQty": -1.5,
        "powerQty": 1000,
        "otherCost": 200,
        "byproduct": 0,
        "byproductLabel": "\u526f\u4ea7\u84b8\u6c7d",
        "spreadLabel": "\u5408\u6210\u6c28-\u7164",
        "plant": {
            "capacity": "40\u4e07\u5428/\u5e74",
            "unitName": "\u5408\u6210\u6c28\u6c14\u5316\u88c5\u7f6e\uff08A/B/C\u4e09\u53f0\u6c14\u5316\u7089\uff09",
            "status": "A\u7089\u8fde\u8fd0205\u5929\u3001B\u7089268\u5929\u3001C\u7089180\u5929\u521b\u5386\u53f2\u6700\u4f73\uff0c\u4e00\u5b63\u5ea6\u6db2\u6c28\u4ea7\u91cf11.56\u4e07\u5428\u540c\u6bd4\u589e3.9%",
            "advantage": "\u56ed\u533a\u9f99\u5934\u88c5\u7f6e\uff0c\u4e3a\u4e0b\u6e38\u5df1\u5185\u9170\u80fa/\u5df1\u4e8c\u9178/\u53cc\u6c27\u6c34\u63d0\u4f9b\u539f\u6599\uff0c\u526f\u4ea7\u84b8\u6c7d\u964d\u4f4e\u516c\u7528\u5de5\u7a0b\u6210\u672c",
        },
    },
    {
        "name": "\u53cc\u6c27\u6c34",
        "productPrice": 597,
        "threshold": 100,
        "rawMaterials": [],
        "h2Qty": 70,
        "steamQty": 0.5,
        "powerQty": 150,
        "otherCost": 100,
        "byproduct": 0,
        "spreadLabel": "\u53cc\u6c27\u6c34-\u6c22\u6c14",
        "plant": {
            "capacity": "24\u4e07\u5428/\u5e74",
            "unitName": "\u53cc\u6c27\u6c34\u88c5\u7f6e\uff08\u5c3c\u9f99\u8f66\u95f4\u7ba1\u8f96\uff09",
            "status": "\u65e5\u4ea7\u80fd730\u5428/\u5929\uff0c\u8fbe\u884c\u4e1a\u540c\u7b49\u89c4\u6a21\u504f\u4e0a\u6c34\u5e73\uff0c\u4e00\u952e\u505c\u8f66\u7cfb\u7edf\u6295\u8fd0",
            "advantage": "\u4ea7\u80fd\u4ece650\u5428/\u5929\u63d0\u5347\u81f3730\u5428/\u5929\uff0c\u7a33\u4ea7\u5373\u9ad8\u4ea7\uff0c\u5b89\u5168\u81ea\u52a8\u5316\u7a0b\u5ea6\u9ad8",
        },
    },
    {
        "name": "\u785d\u9178",
        "productPrice": 1310,
        "threshold": 150,
        "rawMaterials": [
            {"label": "\u6db2\u6c28", "qty": 0.29, "unit": "\u5428", "price": 2293}
        ],
        "h2Qty": 0,
        "steamQty": -0.8,
        "powerQty": 60,
        "otherCost": 120,
        "byproduct": 0,
        "byproductLabel": "\u526f\u4ea7\u84b8\u6c7d",
        "spreadLabel": "\u785d\u9178-\u6db2\u6c28",
        "plant": {
            "capacity": "27\u4e07\u5428/\u5e74",
            "unitName": "\u785d\u9178\u88c5\u7f6e\uff08A/B\u53cc\u7ebf\uff09",
            "status": "\u53cc\u52a0\u538b\u6cd5\u5de5\u827a\uff0cA\u7ebf\u6ee1\u8d1f\u8377\u8fd0\u884c\uff0cB\u7ebf2024\u5e74\u5b8c\u6210\u50ac\u5316\u5242\u66f4\u6362\uff0c\u5c3e\u6c14\u5904\u7406\u8fbe\u6807",
            "advantage": "\u53cc\u52a0\u538b\u6cd5\u80fd\u6548\u9ad8\uff0c\u526f\u4ea7\u84b8\u6c7d\u56de\u6536\u5229\u7528\uff0c\u6c28\u8017\u63a7\u5236\u57200.29\u5428/\u5428\u4ee5\u4e0b\u884c\u4e1a\u9886\u5148",
        },
    },
]

# Static peer plants data
PEER_PLANTS = [
    {
        "name": "\u4e2d\u56fd\u5e73\u7164\u795e\u9a6c\u96c6\u56e2",
        "location": "\u6cb3\u5357\u5e73\u9876\u5c71",
        "products": [
            "\u5df1\u5185\u9170\u80fa",
            "\u5df1\u4e8c\u9178",
            "\u5c3c\u9f996",
            "\u73af\u5df1\u916e",
            "\u5df1\u4e8c\u8148",
        ],
        "capacity": "\u5df1\u5185\u9170\u80fa40\u4e07\u5428/\u5e74 + \u73af\u5df1\u918725\u4e07\u5428/\u5e74 + \u5df1\u4e8c\u814820\u4e07\u5428/\u5e74(\u4e00\u671f)",
        "status": "2026\u5e744\u6708\u5df1\u4e8c\u8148\u4e00\u671f\u6295\u4ea7\uff0c\u4ea7\u54c1\u7eaf\u5ea699.9%\u3002\u6c22\u6c28\u9879\u76ee(\u5408\u6210\u6c2840\u4e07\u5428+\u6c22\u6c144\u4ebf\u6807\u65b9)2023\u5e74\u6295\u8fd0\uff0c\u4e3a\u56ed\u533a\u964d\u672c8.74\u4ebf\u5143\u3002\u5c3c\u9f99\u4ea7\u4e1a\u94fe\u5b8c\u6574\u5e03\u5c40\uff0c\u5343\u4ebf\u7ea7\u5c3c\u9f99\u57ce\u52a0\u901f\u6210\u578b\u3002",
        "note": "\u56fd\u5185\u552f\u4e00\u540c\u65f6\u638c\u63e1\u5df1\u5185\u9170\u80fa\u6cd5\u548c\u4e01\u4e8c\u70ef\u6cd5\u4e24\u6761\u5df1\u4e8c\u8148\u8def\u7ebf\u7684\u4f01\u4e1a\uff0c\u4ea7\u4e1a\u94fe\u4e00\u4f53\u5316\u7a0b\u5ea6\u6700\u9ad8\uff0c\u662f\u592a\u5316\u6700\u5f3a\u52b2\u7684\u534e\u5317\u5468\u8fb9\u7ade\u4e89\u5bf9\u624b",
    },
    {
        "name": "\u534e\u9c81\u6052\u5347",
        "location": "\u5c71\u4e1c\u5fb7\u5dde/\u8346\u5dde",
        "products": [
            "\u5df1\u5185\u9170\u80fa",
            "\u5df1\u4e8c\u9178",
            "\u5c3c\u9f996",
            "\u73af\u5df1\u916e",
            "\u5408\u6210\u6c28",
        ],
        "capacity": "\u5df1\u5185\u9170\u80fa30\u4e07\u5428/\u5e74 + \u5df1\u4e8c\u917820\u4e07\u5428/\u5e74(\u5c3c\u9f6666\u914d\u5957) + \u5c3c\u9f996 30\u4e07\u5428/\u5e74 + \u73af\u5df1\u916e40\u4e07\u5428/\u5e74",
        "status": "2024\u5e7411\u6708\u5c3c\u9f996\u88c5\u7f6e\u6295\u4ea7\uff0c12\u6708\u5df1\u4e8c\u9178\u88c5\u7f6e\u8bd5\u751f\u4ea7\u3002\u4e00\u5934\u591a\u7ebf\u7164\u6c14\u5316\u5e73\u53f0\uff0c\u5408\u6210\u6c28/\u5c3f\u7d20/\u5df1\u5185\u9170\u80fa/\u5df1\u4e8c\u9178\u4e00\u4f53\u5316\u30022026Q1\u51c0\u5229\u6da611.17\u4ebf\u5143\u540c\u6bd4\u589e58%\uff0c\u6210\u672c\u63a7\u5236\u80fd\u529b\u884c\u4e1a\u6807\u6746\u3002",
        "note": "\u7164\u5934\u4e00\u4f53\u5316\u6210\u672c\u4f18\u52bf\u7a81\u51fa\uff0c\u7efc\u5408\u6210\u672c\u6bd4\u884c\u4e1a\u5e73\u5747\u4f4e\u7ea620%\uff0c\u8346\u5dde\u57fa\u5730\u65b0\u589e\u4ea7\u80fd\u6301\u7eed\u91ca\u653e\uff0c\u5bf9\u592a\u5316\u534e\u5317\u5e02\u573a\u4efd\u989d\u6784\u6210\u76f4\u63a5\u6324\u538b",
    },
    {
        "name": "\u5170\u82b1\u79d1\u521b",
        "location": "\u5c71\u897f\u664b\u57ce",
        "products": ["\u5df1\u5185\u9170\u80fa", "\u5408\u6210\u6c28", "\u5c3f\u7d20"],
        "capacity": "\u5df1\u5185\u9170\u80fa20\u4e07\u5428/\u5e74 + \u5408\u6210\u6c28\u914d\u5957",
        "status": "\u7164\u70ad-\u5408\u6210\u6c14-\u5408\u6210\u6c28-\u5df1\u5185\u9170\u80fa\u4e00\u4f53\u5316\u4ea7\u4e1a\u94fe\uff0c\u81ea\u6709\u4f18\u8d28\u65e0\u70df\u7164\u539f\u6599\u4f18\u52bf\u30022025\u5e74\u7164\u5236\u82b3\u70f9\u6218\u7565\u5e03\u5c40\u63a8\u8fdb\u4e2d\u3002",
        "note": "\u540c\u5904\u5c71\u897f\uff0c\u539f\u6599\u7164\u81ea\u7ed9\u6210\u672c\u4f18\u52bf\u660e\u663e\uff0c\u4e0e\u592a\u5316\u5728\u5df1\u5185\u9170\u80fa\u5e02\u573a\u76f4\u63a5\u7ade\u4e89\uff0c\u7701\u5185\u540c\u8d5b\u9053\u5bf9\u624b",
    },
    {
        "name": "\u6052\u7533\u96c6\u56e2(\u7533\u8fdc)",
        "location": "\u798f\u5efa\u8fde\u6c5f",
        "products": ["\u5df1\u5185\u9170\u80fa", "\u5c3c\u9f996"],
        "capacity": "\u5df1\u5185\u9170\u80fa100\u4e07\u5428/\u5e74(\u5168\u7403\u6700\u5927)",
        "status": "2023\u5e74\u56db\u7ebf\u5efa\u6210\u6295\u4ea7\uff0c\u5b9e\u73b0\u5e74\u4ea7100\u4e07\u5428\u5df1\u5185\u9170\u80fa\u4e00\u4f53\u5316\u6218\u7565\uff0c\u5efa\u6210\u5168\u7403\u552f\u4e00\u5b8c\u6574\u5e03\u5c40\u9526\u7eb6-6\u516b\u9053\u4ea7\u4e1a\u94fe\u7684\u4ea7\u4e1a\u56ed\u533a\u3002",
        "note": "\u5168\u7403\u5df1\u5185\u9170\u80fa\u4ea7\u80fd\u7b2c\u4e00\uff0c\u89c4\u6a21\u6548\u5e94\u788e\u538b\uff0c\u5bf9\u5168\u56fd\u5df1\u5185\u9170\u80fa\u5b9a\u4ef7\u6743\u5f71\u54cd\u6781\u5927\uff0c\u592a\u5316\u552e\u4ef7\u88ab\u52a8\u8ddf\u968f\u5176\u8c03\u4ef7\u8282\u594f",
    },
    {
        "name": "\u534e\u5cf0\u5316\u5b66",
        "location": "\u91cd\u5e86",
        "products": ["\u5df1\u4e8c\u9178", "\u5c3c\u9f6666"],
        "capacity": "\u5df1\u4e8c\u9178115\u4e07\u5428/\u5e74(\u516d\u671f\u5df2\u6295\u4ea7)",
        "status": "2024\u5e7412\u6708\u5df1\u4e8c\u9178\u516d\u671f115\u4e07\u5428/\u5e74\u6269\u5efa\u9879\u76ee\u6b63\u5f0f\u6295\u4ea7\uff0c\u5df1\u4e8c\u9178\u4ea7\u80fd\u548c\u4ea7\u91cf\u5747\u5c45\u884c\u4e1a\u9886\u5148\u3002\u91cd\u5e86\u57fa\u573030\u4e07\u5428/\u5e74\u5df1\u4e8c\u8148\u4e09\u671f+\u5c3c\u9f6666\u4e00\u4f53\u5316\u9879\u76ee\u6301\u7eed\u63a8\u8fdb\u3002",
        "note": "\u56fd\u5185\u5df1\u4e8c\u9178\u7edd\u5bf9\u9f99\u5934\uff0c\u4ea7\u80fd\u5360\u6bd4\u8d8540%\uff0c\u65b0\u589e\u4ea7\u80fd\u6295\u653e\u76f4\u63a5\u538b\u5236\u5df1\u4e8c\u9178\u4ef7\u683c\uff0c\u592a\u5316\u5df1\u4e8c\u9178\u552e\u4ef7\u53d7\u5176\u5f00\u5de5\u7387\u76f4\u63a5\u5f71\u54cd",
    },
    {
        "name": "\u9c81\u897f\u5316\u5de5",
        "location": "\u5c71\u4e1c\u804a\u57ce",
        "products": ["\u5df1\u5185\u9170\u80fa", "\u5c3c\u9f996"],
        "capacity": "\u5df1\u5185\u9170\u80fa60\u4e07\u5428/\u5e74 + \u5c3c\u9f996 60\u4e07\u5428/\u5e74(\u4e00\u671f30\u4e07\u5df2\u6295\u4ea7)",
        "status": "60\u4e07\u5428/\u5e74\u5df1\u5185\u9170\u80fa\u00b7\u5c3c\u9f996\u9879\u76ee\u4e00\u671f(30\u4e07CPL+30\u4e07PA6)\u5df2\u5f00\u5de5\uff0c\u4e0e\u4e2d\u5316\u96c6\u56e2\u878d\u5408\u5f00\u542f\u65b0\u4e00\u8f6e\u6210\u957f\u3002",
        "note": "\u5c71\u4e1c\u5730\u533aCPL+PA6\u4e00\u4f53\u5316\u4ea7\u80fd\u5feb\u901f\u6269\u5f20\uff0c\u4e0e\u592a\u5316\u5728\u5c3c\u9f996\u5207\u7247\u5e02\u573a\u76f4\u63a5\u7ade\u4e89\uff0c\u4e2d\u5316\u7cfb\u8d44\u6e90\u52a0\u6301\u540e\u7ade\u4e89\u529b\u589e\u5f3a",
    },
    {
        "name": "\u4e2d\u56fd\u77f3\u5316(\u6e56\u5357\u77f3\u5316)",
        "location": "\u6e56\u5357\u5cb3\u9633",
        "products": ["\u5df1\u5185\u9170\u80fa"],
        "capacity": "\u5df1\u5185\u9170\u80fa60\u4e07\u5428/\u5e74(\u5168\u7403\u5355\u5957\u6700\u5927)",
        "status": "\u5e74\u4ea760\u4e07\u5428\u5df1\u5185\u9170\u80fa\u4ea7\u4e1a\u94fe\u642c\u8fc1\u4e0e\u5347\u7ea7\u8f6c\u578b\u53d1\u5c55\u9879\u76ee\u5df2\u5168\u7ebf\u5f00\u8f66\uff0c\u6280\u672f\u9886\u5148\u3002",
        "note": "\u5168\u7403\u5355\u5957\u4ea7\u80fd\u6700\u5927\u3001\u6280\u672f\u6700\u5148\u8fdb\u7684\u5df1\u5185\u9170\u80fa\u57fa\u5730\uff0c\u5bf9\u5168\u56fdCPL\u4f9b\u5e94\u683c\u5c40\u548c\u5b9a\u4ef7\u6709\u51b3\u5b9a\u6027\u5f71\u54cd",
    },
]

DEFAULT_COSTS = {"h2": 1.50, "steam": 220, "power": 0.55}


# ==================== Fetch Functions ====================


def fetch_url(url, timeout=15, retries=2, headers=None):
    """Fetch URL with retries (urllib, no external dependency)"""
    use_headers = headers or HEADERS
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers=use_headers)
            with urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                html = raw.decode("utf-8", errors="replace")
                if "HW_CHECK" not in html:
                    return html
                else:
                    print(f"  [WARN] anti-crawl blocked: {url}")
                    return None
        except Exception as e:
            if attempt < retries:
                time.sleep(2)
                continue
            print(f"  [ERROR] request failed: {url} -> {e}")
            return None
    return None


def parse_vane_price(html):
    """Extract benchmark price from vane page"""
    m = re.search(
        r"\u57fa\u51c6\u4ef7[\u4e3a\uff1a:\s]*(\d+\.?\d*)\s*\u5143?\s*/?\s*\u5428?",
        html,
    )
    if m:
        return float(m.group(1))
    m = re.search(r"\u53c2\u8003\u4ef7[\u4e3a\uff1a:\s]*(\d+\.?\d*)", html)
    if m:
        return float(m.group(1))
    return None


def fetch_week_pct(vid):
    """Fetch weekly change % from 100ppi graph API"""
    url = f"https://www.100ppi.com/graph/cindex.php?f=graph_per_week&ppid={vid}"
    html = fetch_url(url, headers=HEADERS)
    if not html or len(html) < 100:
        return None

    dates = re.findall(r"'(\d{4}-\d{2}-\d{2})'", html)
    if not dates:
        return None

    bar_arrays = re.findall(r"data:\s*\[([^\]]+)\]", html)
    up_series = None
    down_series = None

    for arr_str in bar_arrays:
        parts = [p.strip().strip("'") for p in arr_str.split(",")]
        values = []
        has_dash = False
        has_num = False
        for p in parts:
            if p == "-":
                values.append(None)
                has_dash = True
            else:
                try:
                    v = float(p)
                    values.append(v)
                    has_num = True
                except ValueError:
                    values.append(None)

        if has_dash and has_num and len(values) >= 10:
            nums = [v for v in values if v is not None]
            if nums and all(v >= 0 for v in nums):
                up_series = values
            elif nums and all(v <= 0 for v in nums):
                down_series = values

    if up_series or down_series:
        for i in range(len(dates) - 1, -1, -1):
            up_val = up_series[i] if up_series and i < len(up_series) else None
            down_val = down_series[i] if down_series and i < len(down_series) else None
            if up_val is not None:
                return up_val
            if down_val is not None:
                return down_val
    return None


def fetch_daily_change(vid, vane_name):
    """Fetch daily price + change from mobile vane page"""
    import urllib.parse

    encoded = urllib.parse.quote(vane_name)
    url = f"https://m1.100ppi.com/vane/{vid}-{encoded}.html"
    html = fetch_url(url, headers=MOBILE_HEADERS)
    if not html or "HW_CHECK" in html:
        return None, None

    idx = html.find("\u65e5\u6da8\u8dcc")
    if idx < 0:
        return None, None

    table_text = html[idx : idx + 1000]
    clean = re.sub(r"<[^>]+>", "|", table_text)
    clean = re.sub(r"\|+", "|", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    parts = [p.strip() for p in clean.split("|") if p.strip()]

    for i in range(len(parts) - 2):
        if (
            re.match(r"\d{2}-\d{2}$", parts[i])
            and re.match(r"[\d.]+$", parts[i + 1])
            and re.match(r"-?[\d.]+%$", parts[i + 2])
        ):
            price = float(parts[i + 1])
            day_pct = float(parts[i + 2].rstrip("%"))
            return price, day_pct
    return None, None


def fetch_subsite_daily_change(url):
    """Fetch daily change from subsite (compare today vs yesterday benchmark)"""
    html = fetch_url(url, headers=HEADERS)
    if not html:
        return None, None

    idx = html.find("\u57fa\u51c6\u4ef7")
    if idx < 0:
        return None, None

    table_text = html[idx : idx + 1500]
    clean = re.sub(r"<[^>]+>", "|", table_text)
    clean = re.sub(r"\|+", "|", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    parts = [p.strip() for p in clean.split("|") if p.strip()]

    prices = []
    for part in parts:
        m = re.search(r"\u57fa\u51c6\u4ef7\u4e3a([\d.]+)\u5143/\u5428", part)
        if m:
            prices.append(float(m.group(1)))

    if len(prices) >= 2:
        today_price = prices[0]
        yesterday_price = prices[1]
        change = round(today_price - yesterday_price, 2)
        change_pct = (
            round(change / yesterday_price * 100, 2) if yesterday_price > 0 else 0
        )
        return change, change_pct
    return None, None


def parse_subsite_price(html):
    """Extract benchmark price from subsite"""
    m = re.search(r"\u57fa\u51c6\u4ef7[\u4e3a\uff1a:\s]*(\d+\.?\d*)", html)
    if m:
        return float(m.group(1))
    m = re.search(r"\u53c2\u8003\u4ef7[\u4e3a\uff1a:\s]*(\d+\.?\d*)", html)
    if m:
        return float(m.group(1))
    return None


# ==================== Main Fetch Logic ====================


def fetch_all_prices():
    """Fetch all prices, returns dict: name -> {price, change, changePct, weekPct, trend}"""
    results = {}
    failed = []

    # 1. Vane sources
    print("\n--- Vane sources ---")
    for name, config in VANE_SOURCES.items():
        html = fetch_url(config["url"])
        price = parse_vane_price(html) if html else None
        vid = config["vid"]

        if price is not None:
            week_pct = fetch_week_pct(vid)
            time.sleep(0.3)

            vane_name = MOBILE_VANE_NAMES.get(vid, name)
            day_price, day_pct = fetch_daily_change(vid, vane_name)
            time.sleep(0.3)

            if day_pct is not None and day_pct != 0:
                yesterday = price / (1 + day_pct / 100)
                change = round(price - yesterday, 2)
            else:
                change = 0.0
                day_pct = 0.0

            if week_pct is not None:
                if week_pct > 0.01:
                    trend = "up"
                elif week_pct < -0.01:
                    trend = "down"
                else:
                    trend = "flat"
            elif day_pct > 0.01:
                trend = "up"
            elif day_pct < -0.01:
                trend = "down"
            else:
                trend = "flat"

            results[name] = {
                "price": price,
                "change": change,
                "changePct": day_pct if day_pct is not None else 0.0,
                "weekPct": week_pct if week_pct is not None else 0.0,
                "trend": trend,
            }
            proxy = f" [proxy: {config['proxy_for']}]" if "proxy_for" in config else ""
            wp = f", weekPct={week_pct}%" if week_pct is not None else ""
            print(f"  [OK] {name}: {price}{proxy}{wp}")
        else:
            print(f"  [FAIL] {name}: no price")
            failed.append(name)
        time.sleep(0.5)

    # 2. Subsite sources
    print("\n--- Subsite sources ---")
    for name, config in SUBSITE_SOURCES.items():
        html = fetch_url(config["url"])
        price = parse_subsite_price(html) if html else None

        if price is not None:
            sub_change, sub_pct = fetch_subsite_daily_change(config["url"])
            week_pct = fetch_week_pct(config["ppid"])
            time.sleep(0.3)

            if sub_change is not None:
                change = sub_change
                day_pct = sub_pct
            else:
                change = 0.0
                day_pct = 0.0

            if week_pct is not None:
                if week_pct > 0.01:
                    trend = "up"
                elif week_pct < -0.01:
                    trend = "down"
                else:
                    trend = "flat"
            elif day_pct is not None and day_pct > 0.01:
                trend = "up"
            elif day_pct is not None and day_pct < -0.01:
                trend = "down"
            else:
                trend = "flat"

            results[name] = {
                "price": price,
                "change": change,
                "changePct": day_pct,
                "weekPct": week_pct if week_pct is not None else 0.0,
                "trend": trend,
            }
            wp = f", weekPct={week_pct}%" if week_pct is not None else ""
            print(f"  [OK] {name}: {price}{wp}")
        else:
            print(f"  [FAIL] {name}: no price")
            failed.append(name)
        time.sleep(0.5)

    # 3. Liquid ammonia = synthetic ammonia (same data)
    if "\u5408\u6210\u6c28" in results and "\u6db2\u6c28" not in results:
        results["\u6db2\u6c28"] = dict(results["\u5408\u6210\u6c28"])
        print(
            "  [OK] \u6db2\u6c28: %s (same as \u5408\u6210\u6c28)"
            % results["\u6db2\u6c28"]["price"]
        )

    return results, failed


# ==================== Build data.json ====================


def load_existing_data():
    """Load existing data.json for fallback prices"""
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def build_data(prices, existing):
    """Build the final data structure"""
    existing_prices = {}
    if existing:
        for item in (
            existing.get("products", [])
            + existing.get("rawMaterials", [])
            + existing.get("intermediates", [])
        ):
            existing_prices[item["name"]] = item
        for line in existing.get("profitLines", []):
            for rm in line.get("rawMaterials", []):
                if rm["label"] not in existing_prices:
                    existing_prices[rm["label"]] = {"price": rm["price"]}

    def build_item(name):
        meta = PRODUCT_META.get(name)
        if not meta:
            return None
        p = prices.get(name)
        if not p:
            if name in existing_prices:
                p = existing_prices[name]
                print(f"  [FALLBACK] {name}: using last={p.get('price', '?')}")
            else:
                print(f"  [SKIP] {name}: no data")
                return None
        return {
            "name": name,
            "formula": meta["formula"],
            "price": p["price"],
            "unit": meta["unit"],
            "change": p.get("change", 0),
            "changePct": p.get("changePct", 0),
            "weekPct": p.get("weekPct", 0),
            "trend": p.get("trend", "flat"),
            "tag": meta["tag"],
        }

    products = [item for item in (build_item(n) for n in PRODUCTS_ORDER) if item]
    rawMaterials = [
        item for item in (build_item(n) for n in RAW_MATERIALS_ORDER) if item
    ]
    intermediates = [
        item for item in (build_item(n) for n in INTERMEDIATES_ORDER) if item
    ]

    # Update profit lines with fetched prices
    profit_lines = []
    for line in PROFIT_LINES:
        line_copy = dict(line)

        price_key = PROFIT_LINE_PRICE_MAP.get(line_copy["name"])
        if price_key and price_key in prices:
            line_copy["productPrice"] = prices[price_key]["price"]

        raw_map = PROFIT_LINE_RAW_MAP.get(line_copy["name"], [])
        new_raws = []
        for rm in line_copy["rawMaterials"]:
            rm_copy = dict(rm)
            for label, pkey in raw_map:
                if rm_copy["label"] == label:
                    if pkey and pkey in prices:
                        rm_copy["price"] = prices[pkey]["price"]
                    elif label in existing_prices:
                        rm_copy["price"] = existing_prices[label].get(
                            "price", rm_copy["price"]
                        )
                    break
            new_raws.append(rm_copy)
        line_copy["rawMaterials"] = new_raws
        profit_lines.append(line_copy)

    return {
        "lastUpdate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "products": products,
        "rawMaterials": rawMaterials,
        "intermediates": intermediates,
        "defaultCosts": DEFAULT_COSTS,
        "profitLines": profit_lines,
        "peerPlants": PEER_PLANTS,
    }


# ==================== Main ====================


def main():
    print("=" * 60)
    print("Taihua Price Board - Price Fetcher")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    existing = load_existing_data()

    print("\n[1/2] Fetching prices...")
    prices, failed = fetch_all_prices()
    print(f"\nResult: {len(prices)} fetched, {len(failed)} failed")
    if failed:
        print(f"Failed: {', '.join(failed)}")

    if not prices:
        print("\n[ERROR] No prices fetched, aborting")
        sys.exit(1)

    print("\n[2/2] Building data.json...")
    data = build_data(prices, existing)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\nOutput: %s" % OUTPUT_FILE)
    print(
        "Products: %s | Raw: %s | Mid: %s | Profit: %s"
        % (
            len(data["products"]),
            len(data["rawMaterials"]),
            len(data["intermediates"]),
            len(data["profitLines"]),
        )
    )
    print("Done!")


if __name__ == "__main__":
    main()
