import { HookExtensionContext } from '@directus/extensions';

export const updateDatabase = (context: HookExtensionContext) => {
  const { database, getSchema, services, logger, env } = context;

  // drop legacy column from directus_files
  database.schema
    .hasColumn('directus_files', 'focal_point')
    .then(async columnExists => {
      if (columnExists) {
        await database.schema.alterTable(
          'directus_files',
          table => table.dropColumn('focal_point')
        );

        return;
      }
    })
  ;

  // delete legacy field from file item view
  database('directus_fields').where('field', 'focal_point').del();

  // create important_part column
  database.schema
    .hasColumn('directus_files', 'important_part')
    .then(async columnExists => {
      if (columnExists) {
        env.NODE_ENV === 'development' && logger.info('[extension-assets] Database is up-to-date');

        return;
      }

      await database.schema.alterTable(
        'directus_files',
        table => table.json('important_part')
      );

      env.NODE_ENV === 'development' && logger.info('[extension-assets] Database column created');

      const schema = await getSchema();
      const items = new services.ItemsService('directus_fields', { schema });

      await items.createOne({
        collection: 'directus_files',
        field: 'important_part',
        interface: 'ameotoko-important-part',
        special: 'cast-json',
        width: 'full',

        // disable for all MIME-types except "image/*"
        conditions: [
          {
            name: 'Show only for images',
            hidden: true,
            options: {
              allowNone: false,
              allowOther: false
            },
            rule: {
              _and: [
                {
                  type: { _nstarts_with: 'image/' }
                }
              ]
            }
          }
        ]
      });

      env.NODE_ENV === 'development' && logger.info('[extension-assets] Field added');
    })
  ;
}
