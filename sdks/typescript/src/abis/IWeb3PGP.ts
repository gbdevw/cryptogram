export const IWeb3PGP = [
    {
        "type": "function",
        "name": "exist",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getKeyPublication",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getKeyPublicationBatch",
        "inputs": [
            {
                "name": "fingerprints",
                "type": "bytes32[]",
                "internalType": "bytes32[]"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256[]",
                "internalType": "uint256[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "isSubKey",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "listRevocations",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "start",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "limit",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256[]",
                "internalType": "uint256[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "listSubkeys",
        "inputs": [
            {
                "name": "parentKeyFingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "start",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "limit",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32[]",
                "internalType": "bytes32[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "parentOf",
        "inputs": [
            {
                "name": "subkeyFingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "registerPublicKey",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "openPGPMsg",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "registerPublicSubkey",
        "inputs": [
            {
                "name": "parentKeyFingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "subkeyFingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "openPGPMsg",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "revokeKey",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "revocationCertificate",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "event",
        "name": "NewPublicKey",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "openPGPMsg",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "NewPublicSubkey",
        "inputs": [
            {
                "name": "parentKeyFingerprint",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "subkeyFingerprint",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "openPGPMsg",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "NewRevocationCertificate",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "revocationCertificate",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyRegistered",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "NotRegistered",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "ParentIsASubkey",
        "inputs": [
            {
                "name": "fingerprint",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    }
];