# ZONE_TARIFF precedence vector (v13)

Committed copy of the 13-case vector published by queandabuscando's sync contract
(`sync-contract.md`, section "Vector de precedencia de ZONE_TARIFF (v13)"), fixed against the
sha256 the contract publishes for this exact block in "El hash del bloque JSON de arriba
(S-007, punto 6)": `0a4fbe39e79054ffcd47b42450f1deeb35d823644b610b7602c147ff0e175bc0`
(10777 bytes).

This prose lives outside the fence and is not part of the hashed bytes. The fence below is the
only one in this file, and its content is byte-for-byte what queandabuscando published — no
reformatting, no re-serialization, and no trailing newline inside the block.

```json
{
  "version": "1",
  "fixture": {
    "zones": [
      {
        "code": "03.05",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      {
        "code": "03.03",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      {
        "code": "03.04",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      {
        "code": "03.07",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      {
        "code": "04.02",
        "level": "MUNICIPALITY",
        "provinceCode": "04"
      },
      {
        "code": "04.05",
        "level": "MUNICIPALITY",
        "provinceCode": "04"
      },
      {
        "code": "05.03",
        "level": "MUNICIPALITY",
        "provinceCode": "05"
      },
      {
        "code": "05.04",
        "level": "MUNICIPALITY",
        "provinceCode": "05"
      },
      {
        "code": "06.01",
        "level": "MUNICIPALITY",
        "provinceCode": "06"
      },
      {
        "code": "03.40",
        "level": "FIRST_LEVEL",
        "provinceCode": "03"
      },
      {
        "code": "03.09",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      {
        "code": "03.10",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      {
        "code": "03.11",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      }
    ],
    "rows": [
      {
        "zoneCode": "03.05",
        "rule": "NOT_SERVED"
      },
      {
        "zoneCode": "03.03",
        "rule": "INHERIT"
      },
      {
        "zoneCode": "03",
        "rule": "FEE",
        "deliveryFee": 300
      },
      {
        "zoneCode": "03.07",
        "rule": "FEE",
        "deliveryFee": 150
      },
      {
        "zoneCode": "04.02",
        "rule": "FEE",
        "deliveryFee": 200
      },
      {
        "zoneCode": "04",
        "rule": "NOT_SERVED"
      },
      {
        "zoneCode": "05.03",
        "rule": "FEE",
        "deliveryFee": 250
      },
      {
        "zoneCode": "05",
        "rule": "INHERIT"
      },
      {
        "zoneCode": "03.09",
        "rule": "FEE"
      },
      {
        "zoneCode": "03.10",
        "rule": "FEE",
        "deliveryFee": 0
      },
      {
        "zoneCode": "03.11",
        "rule": "FEE",
        "deliveryFee": -50
      }
    ]
  },
  "cases": [
    {
      "id": "V1",
      "zone": {
        "code": "03.05",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03.05",
          "rule": "NOT_SERVED"
        }
      ],
      "expected": {
        "served": false,
        "deliveryFee": null,
        "decidedBy": "03.05",
        "path": [
          {
            "code": "03.05",
            "level": "MUNICIPALITY",
            "verdict": "NOT_SERVED",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V2",
      "zone": {
        "code": "03.03",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03.03",
          "rule": "INHERIT"
        },
        {
          "zoneCode": "03",
          "rule": "FEE",
          "deliveryFee": 300
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "300.00",
        "decidedBy": "03",
        "path": [
          {
            "code": "03.03",
            "level": "MUNICIPALITY",
            "verdict": "INHERIT",
            "decides": false
          },
          {
            "code": "03",
            "level": "FIRST_LEVEL",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V3",
      "zone": {
        "code": "03.04",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03",
          "rule": "FEE",
          "deliveryFee": 300
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "300.00",
        "decidedBy": "03",
        "path": [
          {
            "code": "03.04",
            "level": "MUNICIPALITY",
            "verdict": "ABSENT",
            "decides": false
          },
          {
            "code": "03",
            "level": "FIRST_LEVEL",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V4",
      "zone": {
        "code": "03.07",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03.07",
          "rule": "FEE",
          "deliveryFee": 150
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "150.00",
        "decidedBy": "03.07",
        "path": [
          {
            "code": "03.07",
            "level": "MUNICIPALITY",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V5",
      "zone": {
        "code": "04.02",
        "level": "MUNICIPALITY",
        "provinceCode": "04"
      },
      "rows": [
        {
          "zoneCode": "04.02",
          "rule": "FEE",
          "deliveryFee": 200
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "200.00",
        "decidedBy": "04.02",
        "path": [
          {
            "code": "04.02",
            "level": "MUNICIPALITY",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V6",
      "zone": {
        "code": "04.05",
        "level": "MUNICIPALITY",
        "provinceCode": "04"
      },
      "rows": [
        {
          "zoneCode": "04",
          "rule": "NOT_SERVED"
        }
      ],
      "expected": {
        "served": false,
        "deliveryFee": null,
        "decidedBy": "04",
        "path": [
          {
            "code": "04.05",
            "level": "MUNICIPALITY",
            "verdict": "ABSENT",
            "decides": false
          },
          {
            "code": "04",
            "level": "FIRST_LEVEL",
            "verdict": "NOT_SERVED",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V7",
      "zone": {
        "code": "05.03",
        "level": "MUNICIPALITY",
        "provinceCode": "05"
      },
      "rows": [
        {
          "zoneCode": "05.03",
          "rule": "FEE",
          "deliveryFee": 250
        },
        {
          "zoneCode": "05",
          "rule": "INHERIT"
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "250.00",
        "decidedBy": "05.03",
        "path": [
          {
            "code": "05.03",
            "level": "MUNICIPALITY",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "V8",
      "zone": {
        "code": "05.04",
        "level": "MUNICIPALITY",
        "provinceCode": "05"
      },
      "rows": [
        {
          "zoneCode": "05",
          "rule": "INHERIT"
        }
      ],
      "expected": {
        "served": false,
        "deliveryFee": null,
        "decidedBy": null,
        "path": [
          {
            "code": "05.04",
            "level": "MUNICIPALITY",
            "verdict": "ABSENT",
            "decides": false
          },
          {
            "code": "05",
            "level": "FIRST_LEVEL",
            "verdict": "INHERIT",
            "decides": false
          }
        ]
      }
    },
    {
      "id": "V9",
      "zone": {
        "code": "06.01",
        "level": "MUNICIPALITY",
        "provinceCode": "06"
      },
      "rows": [],
      "expected": {
        "served": false,
        "deliveryFee": null,
        "decidedBy": null,
        "path": [
          {
            "code": "06.01",
            "level": "MUNICIPALITY",
            "verdict": "ABSENT",
            "decides": false
          },
          {
            "code": "06",
            "level": "FIRST_LEVEL",
            "verdict": "ABSENT",
            "decides": false
          }
        ]
      }
    },
    {
      "id": "V10",
      "zone": {
        "code": "03.40",
        "level": "FIRST_LEVEL",
        "provinceCode": "03"
      },
      "rows": [],
      "expected": {
        "served": false,
        "deliveryFee": null,
        "decidedBy": null,
        "path": [
          {
            "code": "03.40",
            "level": "FIRST_LEVEL",
            "verdict": "ABSENT",
            "decides": false
          }
        ]
      }
    },
    {
      "id": "G1",
      "zone": {
        "code": "03.09",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03.09",
          "rule": "FEE"
        },
        {
          "zoneCode": "03",
          "rule": "FEE",
          "deliveryFee": 300
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "300.00",
        "decidedBy": "03",
        "path": [
          {
            "code": "03.09",
            "level": "MUNICIPALITY",
            "verdict": "FEE_WITHOUT_AMOUNT",
            "decides": false
          },
          {
            "code": "03",
            "level": "FIRST_LEVEL",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "G2",
      "zone": {
        "code": "03.10",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03.10",
          "rule": "FEE",
          "deliveryFee": 0
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "0.00",
        "decidedBy": "03.10",
        "path": [
          {
            "code": "03.10",
            "level": "MUNICIPALITY",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    },
    {
      "id": "G3",
      "zone": {
        "code": "03.11",
        "level": "MUNICIPALITY",
        "provinceCode": "03"
      },
      "rows": [
        {
          "zoneCode": "03.11",
          "rule": "FEE",
          "deliveryFee": -50
        },
        {
          "zoneCode": "03",
          "rule": "FEE",
          "deliveryFee": 300
        }
      ],
      "expected": {
        "served": true,
        "deliveryFee": "300.00",
        "decidedBy": "03",
        "path": [
          {
            "code": "03.11",
            "level": "MUNICIPALITY",
            "verdict": "FEE_NEGATIVE",
            "decides": false
          },
          {
            "code": "03",
            "level": "FIRST_LEVEL",
            "verdict": "FEE",
            "decides": true
          }
        ]
      }
    }
  ]
}
```
