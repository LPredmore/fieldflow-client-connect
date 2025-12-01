/**
 * Contexts Index
 * 
 * Central export point for all React contexts.
 */

export { AuthenticationContext, useAuth } from './AuthenticationContext';
export type { User, StaffAttributes, AuthenticationContextValue } from './AuthenticationContext';

export { ClientDataProvider, useClientData } from './ClientDataContext';
export { FormProvider, useFormContext } from './FormContext';
export { PermissionProvider, usePermissionContext } from './PermissionContext';
