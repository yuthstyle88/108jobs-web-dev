import {LocalUser, Person} from "108heros-client";

/**
 * Utility functions for working with ProfileData
 */

/**
 * Get the username from ProfileData
 * @returns The username, preferring person.name if available
 * @param person
 */
export function getUsername(person: Person): string {
  return person?.name || "";
}

/**
 * Get the display name from ProfileData
 * @returns The display name, preferring person.displayName if available
 * @param person
 */
export function getDisplayName(person: Person): string | undefined {
  return person?.displayName || "";
}

/**
 * Get the avatar URL from ProfileData
 * @returns The avatar URL, preferring person.avatar if available
 * @param person
 */
export function getAvatarUrl(person: Person): string | undefined {
  return person?.avatar || "";
}

/**
 * Get the bio from ProfileData
 * @returns The bio, preferring person.bio if available
 * @param person
 */
export function getBio(person: Person): string | null | undefined {
  return person?.bio || "";
}

/**
 * Get the email from ProfileData
 * @returns The email, preferring localUser.email if available
 * @param localUser
 */
export function getEmail(localUser: LocalUser): string | undefined {
  return localUser?.email || "";
}

/**
 * Check if the profile's email is verified
 * @returns Whether the email is verified, preferring localUser.emailVerified if available
 * @param localUser
 */
export function isEmailVerified(localUser: LocalUser): boolean {
  return localUser?.emailVerified ?? false;
}

/**
 * Check if the profile has localUser.admin set
 * Note: for route access and admin navigation, the verified token's `roles` claim
 * (`jobs:admin`) via `useAuthInfo().isAdmin` / `isAdminClaims()` is the source of truth.
 * @returns Whether the local user record has admin set
 * @param localUser
 */
export function isAdmin(localUser: LocalUser): boolean {
  return localUser?.admin ?? false;
}
