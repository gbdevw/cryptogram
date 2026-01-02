// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title ScriptHelpersTest
 * @notice Tests for ScriptHelpers library
 */
contract ScriptHelpersTest is Test {
    using ScriptHelpers for *;

    /*****************************************************************************************************************/
    /* VALIDATION TESTS                                                                                              */
    /*****************************************************************************************************************/

    function test_requireNonZero_WithValidAddress() public pure {
        address validAddress = address(0x1234);
        // Should not revert
        ScriptHelpers.requireNonZero(validAddress, "test");
    }

    function test_requireNonZeroArray_WithValidAddresses() public pure {
        address[] memory addresses = new address[](3);
        addresses[0] = address(0x1111);
        addresses[1] = address(0x2222);
        addresses[2] = address(0x3333);
        // Should not revert
        ScriptHelpers.requireNonZeroArray(addresses, "test");
    }

    function test_requireNonZeroBytes32_WithValidValue() public pure {
        bytes32 validValue = keccak256("test");
        // Should not revert
        ScriptHelpers.requireNonZeroBytes32(validValue, "test");
    }

    function test_requireNonZeroUint256_WithValidValue() public pure {
        uint256 validValue = 12345;
        // Should not revert
        ScriptHelpers.requireNonZeroUint256(validValue, "test");
    }

    /*****************************************************************************************************************/
    /* ENCODING HELPER TESTS                                                                                         */
    /*****************************************************************************************************************/

    function test_encodeSelectorArray_SingleSelector() public pure {
        bytes4 selector = bytes4(keccak256("test()"));
        
        bytes4[] memory result = ScriptHelpers.encodeSelectorArray(selector);
        
        assertEq(result.length, 1);
        assertEq(result[0], selector);
    }

    function test_encodeSelectorArray_TwoSelectors() public pure {
        bytes4 selector1 = bytes4(keccak256("test1()"));
        bytes4 selector2 = bytes4(keccak256("test2()"));
        
        bytes4[] memory result = ScriptHelpers.encodeSelectorArray(selector1, selector2);
        
        assertEq(result.length, 2);
        assertEq(result[0], selector1);
        assertEq(result[1], selector2);
    }

    function test_encodeSelectorArray_ThreeSelectors() public pure {
        bytes4 selector1 = bytes4(keccak256("test1()"));
        bytes4 selector2 = bytes4(keccak256("test2()"));
        bytes4 selector3 = bytes4(keccak256("test3()"));
        
        bytes4[] memory result = ScriptHelpers.encodeSelectorArray(selector1, selector2, selector3);
        
        assertEq(result.length, 3);
        assertEq(result[0], selector1);
        assertEq(result[1], selector2);
        assertEq(result[2], selector3);
    }

    /*****************************************************************************************************************/
    /* TYPE CONVERSION TESTS                                                                                         */
    /*****************************************************************************************************************/

    function test_toUint64_WithValidValue() public pure {
        uint256 value = 123456789;
        
        uint64 result = ScriptHelpers.toUint64(value, "test");
        assertEq(result, 123456789);
    }

    function test_toUint32_WithValidValue() public pure {
        uint256 value = 123456;
        
        uint32 result = ScriptHelpers.toUint32(value, "test");
        assertEq(result, 123456);
    }
}
