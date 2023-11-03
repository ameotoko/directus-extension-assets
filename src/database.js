export const updateDatabase = (context) => {
    const { database, getSchema, services, logger, env } = context;

    database.schema
        .hasColumn('directus_files', 'focal_point')
        .then(async columnExists => {
            if (columnExists) {
                env.NODE_ENV === 'development' && logger.info('[extension-assets] Database is up-to-date');

                return;
            }

            await database.schema.alterTable('directus_files', tableBuilder => {
                tableBuilder.string('focal_point', 16);
            });

            env.NODE_ENV === 'development' && logger.info('[extension-assets] Database column created');

            const { ItemsService } = services;

            const schema = await getSchema();
            const items = new ItemsService('directus_fields', { schema });

            await items.createOne({
                collection: 'directus_files',
                field: 'focal_point',
                interface: 'select-dropdown',
                width: 'half',

                options: {
                    icon: 'photo_size_select_small',
                    choices: [
                        { text: 'Top', value: 'top' },
                        { text: 'Right Top', value: 'right top' },
                        { text: 'Right', value: 'right' },
                        { text: 'Right Bottom', value: 'right bottom' },
                        { text: 'Bottom', value: 'bottom' },
                        { text: 'Left Bottom', value: 'left bottom' },
                        { text: 'Left', value: 'left' },
                        { text: 'Left Top', value: 'left top' }
                    ],
                    allowNone: true
                },

                // hide the field for any MIME-type except "image/*"
                conditions: [
                    {
                        name: "Show only for images",
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
