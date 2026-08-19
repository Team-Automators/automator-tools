// Defines every workflow action this app exposes in the GHL Workflow Builder.
// The `key` is what GHL sends in the webhook `name` field.
// `fields` describes what input data the workflow can supply to each action.

const WORKFLOW_ACTIONS = [
  {
    key: 'create_sub_account',
    name: 'Create Sub-Account',
    description: 'Provisions a new GHL sub-account (location) under the agency.',
    icon: '🏢',
    fields: [
      { key: 'name',        label: 'Business Name',   type: 'TEXT',   required: true },
      { key: 'email',       label: 'Email',            type: 'EMAIL',  required: true },
      { key: 'phone',       label: 'Phone',            type: 'PHONE',  required: false },
      { key: 'firstName',   label: 'Owner First Name', type: 'TEXT',   required: false },
      { key: 'lastName',    label: 'Owner Last Name',  type: 'TEXT',   required: false },
      { key: 'address',     label: 'Address',          type: 'TEXT',   required: false },
      { key: 'city',        label: 'City',             type: 'TEXT',   required: false },
      { key: 'state',       label: 'State',            type: 'TEXT',   required: false },
      { key: 'country',     label: 'Country',          type: 'TEXT',   required: false },
      { key: 'postalCode',  label: 'Postal Code',      type: 'TEXT',   required: false },
      { key: 'timezone',    label: 'Timezone',         type: 'TEXT',   required: false },
      { key: 'website',     label: 'Website',          type: 'TEXT',   required: false },
    ],
    outputs: [
      { key: 'locationId', label: 'New Location ID' },
      { key: 'name',       label: 'Location Name' },
    ],
  },
  {
    key: 'update_sub_account',
    name: 'Update Sub-Account',
    description: 'Updates fields on an existing GHL sub-account/location.',
    icon: '🔄',
    fields: [
      { key: 'locationId',  label: 'Location ID',      type: 'TEXT',   required: true },
      { key: 'name',        label: 'Business Name',    type: 'TEXT',   required: false },
      { key: 'email',       label: 'Email',            type: 'EMAIL',  required: false },
      { key: 'phone',       label: 'Phone',            type: 'PHONE',  required: false },
      { key: 'address',     label: 'Address',          type: 'TEXT',   required: false },
      { key: 'city',        label: 'City',             type: 'TEXT',   required: false },
      { key: 'state',       label: 'State',            type: 'TEXT',   required: false },
      { key: 'country',     label: 'Country',          type: 'TEXT',   required: false },
      { key: 'postalCode',  label: 'Postal Code',      type: 'TEXT',   required: false },
      { key: 'timezone',    label: 'Timezone',         type: 'TEXT',   required: false },
      { key: 'website',     label: 'Website',          type: 'TEXT',   required: false },
      { key: 'firstName',   label: 'Owner First Name', type: 'TEXT',   required: false },
      { key: 'lastName',    label: 'Owner Last Name',  type: 'TEXT',   required: false },
    ],
    outputs: [
      { key: 'locationId', label: 'Location ID' },
    ],
  },
  {
    key: 'create_user',
    name: 'Create User',
    description: 'Creates a new GHL user and assigns them to one or more locations.',
    icon: '👤',
    fields: [
      { key: 'firstName',   label: 'First Name',          type: 'TEXT',   required: true },
      { key: 'lastName',    label: 'Last Name',           type: 'TEXT',   required: true },
      { key: 'email',       label: 'Email',               type: 'EMAIL',  required: true },
      { key: 'password',    label: 'Password',            type: 'TEXT',   required: true },
      { key: 'phone',       label: 'Phone',               type: 'PHONE',  required: false },
      { key: 'type',        label: 'User Type (account|agency)', type: 'TEXT', required: false },
      { key: 'role',        label: 'Role (user|admin)',   type: 'TEXT',   required: false },
      { key: 'locationIds', label: 'Location IDs (comma-sep)', type: 'TEXT', required: false },
    ],
    outputs: [
      { key: 'userId', label: 'New User ID' },
      { key: 'email',  label: 'User Email' },
    ],
  },
  {
    key: 'update_user',
    name: 'Update User',
    description: 'Updates an existing GHL user profile.',
    icon: '✏️',
    fields: [
      { key: 'userId',      label: 'User ID',             type: 'TEXT',   required: true },
      { key: 'firstName',   label: 'First Name',          type: 'TEXT',   required: false },
      { key: 'lastName',    label: 'Last Name',           type: 'TEXT',   required: false },
      { key: 'email',       label: 'Email',               type: 'EMAIL',  required: false },
      { key: 'phone',       label: 'Phone',               type: 'PHONE',  required: false },
      { key: 'type',        label: 'User Type',           type: 'TEXT',   required: false },
      { key: 'role',        label: 'Role',                type: 'TEXT',   required: false },
      { key: 'locationIds', label: 'Location IDs (comma-sep)', type: 'TEXT', required: false },
    ],
    outputs: [
      { key: 'userId', label: 'User ID' },
    ],
  },
  {
    key: 'update_contact',
    name: 'Update Contact',
    description: 'Updates fields on an existing GHL contact record.',
    icon: '📋',
    fields: [
      { key: 'contactId',   label: 'Contact ID',       type: 'TEXT',   required: true },
      { key: 'firstName',   label: 'First Name',       type: 'TEXT',   required: false },
      { key: 'lastName',    label: 'Last Name',        type: 'TEXT',   required: false },
      { key: 'email',       label: 'Email',            type: 'EMAIL',  required: false },
      { key: 'phone',       label: 'Phone',            type: 'PHONE',  required: false },
      { key: 'address1',    label: 'Address',          type: 'TEXT',   required: false },
      { key: 'city',        label: 'City',             type: 'TEXT',   required: false },
      { key: 'state',       label: 'State',            type: 'TEXT',   required: false },
      { key: 'postalCode',  label: 'Postal Code',      type: 'TEXT',   required: false },
      { key: 'country',     label: 'Country',          type: 'TEXT',   required: false },
      { key: 'companyName', label: 'Company Name',     type: 'TEXT',   required: false },
      { key: 'source',      label: 'Source',           type: 'TEXT',   required: false },
      { key: 'tags',        label: 'Tags (comma-sep)', type: 'TEXT',   required: false },
    ],
    outputs: [
      { key: 'contactId', label: 'Contact ID' },
    ],
  },
];

module.exports = WORKFLOW_ACTIONS;
