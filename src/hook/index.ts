import { defineHook } from '@directus/extensions-sdk';
import { File } from '@directus/types';
import { Transformation, TransformationSet } from '@directus/api/dist/types';
import { Range } from '@directus/storage';
import { updateDatabase } from './database.js';
import clone from 'clone';

export default defineHook(({ init }, context) => {
	init('app.before', () => {
		updateDatabase(context);
	});

	init('app.after', () => {
		const { services, logger, env } = context;
		const { AssetsService } = services;

		/*
		 * Directus does not provide extension points ofr hooking into AssetsService,
		 * so we decorate it instead.
		 */
		const getAssetInner = AssetsService.prototype.getAsset;

		AssetsService.prototype.getAsset = async function (id: string, transformation?: TransformationSet, range?: Range) {
			env.NODE_ENV === 'development' && logger.info(`[extension-assets] requested transformation: ${JSON.stringify(transformation)}`);

			const file: File & { focal_point: string } = (await this.knex.select('*').from('directus_files').where({ id }).first());

			// if no focal point defined on the image - it's none of our business
			if (!file?.focal_point) {
				env.NODE_ENV === 'development' && logger.info(`[extension-assets] Focal point not defined, bypassing`);

				return getAssetInner.call(this, id, transformation, range);
			}

			/*
			 * Clone the parameter to break the reference to SYSTEM_ASSET_ALLOW_LIST,
			 * otherwise SYSTEM_ASSET_ALLOW_LIST gets updated, which affects all the
			 * subsequent transformations, until server is restarted.
			 */
			const transformationProcessed = clone(transformation);

			let { width, height, transforms } = transformationProcessed.transformationParams;

			// transforms can be null or undefined
			if (!transforms) {
				transforms = [];
			}

			/*
			 * The magic is in the `position` parameter to Sharp's transformation,
			 * so we add it as soon as transformations array contains `resize` configuration.
			 */
			transforms.forEach((config: Transformation, i: number, transforms: Transformation[] | []) => {
				if (config[0] === 'resize' && !('position' in config[1])) {
					transforms[i][1].position = file.focal_point;
				}
			});

			if (transformationProcessed && (width || height)) {
				transforms.push(['resize', {
					width: width ? Number(width) : undefined,
					height: height ? Number(height) : undefined,
					position: file.focal_point
				}]);

				transformationProcessed.transformationParams.transforms = transforms;
			}

			env.NODE_ENV === 'development' && logger.info(`[extension-assets] processed transformation: ${JSON.stringify(transformationProcessed)}`);

			return getAssetInner.call(this, id, transformationProcessed, range);
		};
	});
});
