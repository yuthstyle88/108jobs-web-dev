// This file defines the response for GET /users/{id}/keys
/**
 * The response containing a user's published public keys.
 */
export type UserKeysResponse = {
  publicKey: string;
};
