import type { Result } from 'neverthrow';

import type { DomainError } from '../../shared/DomainError';
import type { Field } from '../fields/Field';
import type { FieldId } from '../fields/FieldId';
import type { FieldDeletionContext } from '../OnTableFieldDeleted';
import type { ViewColumnMeta } from './ViewColumnMeta';
import type { ViewId } from './ViewId';
import type { ViewQueryDefaults } from './ViewQueryDefaults';

export type ViewFieldDeletionOptionsUpdate = {
  previousOptions: unknown;
  nextOptions: unknown;
};

export type ViewFieldDeletionUpdate = {
  viewId: ViewId;
  fieldId: FieldId;
  columnMeta?: ViewColumnMeta;
  queryDefaults?: ViewQueryDefaults;
  options?: ViewFieldDeletionOptionsUpdate;
};

export interface OnTableViewFieldDeleted {
  onFieldDeleted(
    deletedField: Field,
    context: FieldDeletionContext
  ): Result<ViewFieldDeletionUpdate | undefined, DomainError>;
}

export function implementsOnTableViewFieldDeleted(
  entity: unknown
): entity is OnTableViewFieldDeleted {
  return (
    entity != null &&
    typeof entity === 'object' &&
    'onFieldDeleted' in entity &&
    typeof (entity as OnTableViewFieldDeleted).onFieldDeleted === 'function'
  );
}
