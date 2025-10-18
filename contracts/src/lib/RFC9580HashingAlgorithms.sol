// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RFC 9580 Hashing Algorithm Identifiers
/// @notice Constants mapping to RFC 9580 hashing algorithm IDs
library RFC9580HashingAlgorithms {
    uint8 constant Reserved_0 = 0; // Reserved, ID 0
    uint8 constant MD5 = 1; // MD5 - [RFC1321]
    uint8 constant SHA1 = 2; // SHA-1 - [FIPS180]
    uint8 constant RIPEMD160 = 3; // RIPEMD-160 - [RIPEMD160]
    uint8 constant Reserved_4 = 4; // Reserved
    uint8 constant Reserved_5 = 5;
    uint8 constant Reserved_6 = 6;
    uint8 constant Reserved_7 = 7;
    uint8 constant SHA256 = 8; // SHA2-256 - [FIPS180]
    uint8 constant SHA384 = 9; // SHA2-384 - [FIPS180]
    uint8 constant SHA512 = 10; // SHA2-512 - [FIPS180]
    uint8 constant SHA224 = 11; // SHA2-224 - [FIPS180]
    uint8 constant SHA3_256 = 12; // SHA3-256 - [FIPS202]
    uint8 constant Reserved_8 = 13;
    uint8 constant SHA3_512 = 14; // SHA3-512 - [FIPS202]

    // Reserved/Private Use IDs (starting at 100)
    uint8 constant Reserved_100 = 100;
    uint8 constant Reserved_101 = 101;
    uint8 constant Reserved_102 = 102;
    uint8 constant Reserved_103 = 103;
    uint8 constant Reserved_104 = 104;
    uint8 constant Reserved_105 = 105;
    uint8 constant Reserved_106 = 106;
    uint8 constant Reserved_107 = 107;
    uint8 constant Reserved_108 = 108;
    uint8 constant Reserved_109 = 109;
    uint8 constant Reserved_110 = 110;
}
