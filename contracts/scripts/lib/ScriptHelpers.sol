// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";

/**
 * @title ScriptHelpers
 * @notice Common utilities for Foundry scripts
 * @dev Provides validation, environment variable handling, and encoding utilities
 */
library ScriptHelpers {
    /*****************************************************************************************************************/
    /* ERRORS                                                                                                        */
    /*****************************************************************************************************************/

    /// @notice Thrown when a required address parameter is the zero address
    error ZeroAddressNotAllowed(string paramName);

    /// @notice Thrown when a required environment variable is missing or empty
    error MissingEnvironmentVariable(string varName);

    /// @notice Thrown when a value is invalid
    error InvalidValue(string paramName, string reason);

    /*****************************************************************************************************************/
    /* VALIDATION FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * @notice Validate that an address is not the zero address
     * @param addr The address to validate
     * @param paramName The name of the parameter (for error messages)
     */
    function requireNonZero(address addr, string memory paramName) internal pure {
        if (addr == address(0)) {
            revert ZeroAddressNotAllowed(paramName);
        }
    }

    /**
     * @notice Validate that an address array does not contain zero addresses
     * @param addresses The array of addresses to validate
     * @param paramName The name of the parameter (for error messages)
     */
    function requireNonZeroArray(
        address[] memory addresses,
        string memory paramName
    ) internal pure {
        for (uint256 i = 0; i < addresses.length; ++i) {
            if (addresses[i] == address(0)) {
                revert ZeroAddressNotAllowed(paramName);
            }
        }
    }

    /**
     * @notice Validate that a bytes32 value is not zero
     * @param value The value to validate
     * @param paramName The name of the parameter (for error messages)
     */
    function requireNonZeroBytes32(
        bytes32 value,
        string memory paramName
    ) internal pure {
        if (value == bytes32(0)) {
            revert InvalidValue(paramName, "Cannot be zero");
        }
    }

    /**
     * @notice Validate that a uint256 value is not zero
     * @param value The value to validate
     * @param paramName The name of the parameter (for error messages)
     */
    function requireNonZeroUint256(
        uint256 value,
        string memory paramName
    ) internal pure {
        if (value == 0) {
            revert InvalidValue(paramName, "Cannot be zero");
        }
    }

    /**
     * @notice Validate that multiple environment variables are set
     * @param varNames Array of environment variable names to validate
     */
    function validateEnvVars(string[] memory varNames) internal pure {
        // This would require vm cheatcodes which are not available in libraries
        // Users should call vm.envUint("VAR_NAME") before calling other functions
        // This is a placeholder for documentation purposes
    }

    /*****************************************************************************************************************/
    /* ENVIRONMENT VARIABLE HELPERS                                                                                  */
    /*****************************************************************************************************************/

    /**
     * @notice Safely retrieve an address from environment variables
     * @param varName The environment variable name
     * @dev This function should be called from a Script contract that has access to vm cheatcodes
     * @return The address value
     */
    function getAddressFromEnv(string memory varName) internal pure returns (address) {
        // Note: This function signature is here for documentation. The actual implementation
        // should be in the Script contracts, calling vm.envAddress(varName) directly
        revert("Use vm.envAddress() directly from your Script contract");
    }

    /**
     * @notice Safely retrieve a uint256 from environment variables
     * @param varName The environment variable name
     * @dev This function should be called from a Script contract that has access to vm cheatcodes
     * @return The uint256 value
     */
    function getUint256FromEnv(string memory varName) internal pure returns (uint256) {
        // Note: This function signature is here for documentation. The actual implementation
        // should be in the Script contracts, calling vm.envUint(varName) directly
        revert("Use vm.envUint() directly from your Script contract");
    }

    /**
     * @notice Safely retrieve an optional uint32 from environment variables with default
     * @param varName The environment variable name
     * @param defaultValue The default value if not set
     * @dev This function should be called from a Script contract that has access to vm cheatcodes
     * @return The uint32 value
     */
    function getOptionalUint32(
        string memory varName,
        uint32 defaultValue
    ) internal pure returns (uint32) {
        // Note: This function signature is here for documentation. The actual implementation
        // should be in the Script contracts, calling vm.envOr(varName, defaultValue) directly
        return defaultValue;
    }

    /**
     * @notice Safely retrieve a bytes32 from environment variables
     * @param varName The environment variable name
     * @dev This function should be called from a Script contract that has access to vm cheatcodes
     * @return The bytes32 value
     */
    function getBytes32FromEnv(string memory varName) internal pure returns (bytes32) {
        // Note: This function signature is here for documentation. The actual implementation
        // should be in the Script contracts, calling vm.envBytes32(varName) directly
        revert("Use vm.envBytes32() directly from your Script contract");
    }

    /*****************************************************************************************************************/
    /* ENCODING HELPERS                                                                                              */
    /*****************************************************************************************************************/

    /**
     * @notice Encode a single selector into a bytes4[] array
     * @param selector The function selector
     * @return Array containing the single selector
     */
    function encodeSelectorArray(bytes4 selector)
        internal
        pure
        returns (bytes4[] memory)
    {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = selector;
        return selectors;
    }

    /**
     * @notice Encode two selectors into a bytes4[] array
     * @param selector1 The first function selector
     * @param selector2 The second function selector
     * @return Array containing both selectors
     */
    function encodeSelectorArray(bytes4 selector1, bytes4 selector2)
        internal
        pure
        returns (bytes4[] memory)
    {
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = selector1;
        selectors[1] = selector2;
        return selectors;
    }

    /**
     * @notice Encode three selectors into a bytes4[] array
     * @param selector1 The first function selector
     * @param selector2 The second function selector
     * @param selector3 The third function selector
     * @return Array containing all three selectors
     */
    function encodeSelectorArray(
        bytes4 selector1,
        bytes4 selector2,
        bytes4 selector3
    ) internal pure returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = selector1;
        selectors[1] = selector2;
        selectors[2] = selector3;
        return selectors;
    }

    /*****************************************************************************************************************/
    /* TYPE CONVERSION HELPERS                                                                                       */
    /*****************************************************************************************************************/

    /**
     * @notice Convert a uint256 to uint64 with validation
     * @param value The value to convert
     * @param paramName The name of the parameter (for error messages)
     * @return The converted uint64 value
     */
    function toUint64(uint256 value, string memory paramName)
        internal
        pure
        returns (uint64)
    {
        require(value <= type(uint64).max, paramName);
        return uint64(value);
    }

    /**
     * @notice Convert a uint256 to uint32 with validation
     * @param value The value to convert
     * @param paramName The name of the parameter (for error messages)
     * @return The converted uint32 value
     */
    function toUint32(uint256 value, string memory paramName)
        internal
        pure
        returns (uint32)
    {
        require(value <= type(uint32).max, paramName);
        return uint32(value);
    }
}
