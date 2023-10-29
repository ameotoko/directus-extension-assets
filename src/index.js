import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ init }, { /*logger, */services: { AssetsService } }) => {
	init('app.after', () => {
		const getAssetInner = AssetsService.prototype.getAsset;

		AssetsService.prototype.getAsset = async function (id, transformation, range) {
			// logger.info(`Asset input parameter: ${JSON.stringify(transformation)}`);

			const file = (await this.knex.select('*').from('directus_files').where({ id }).first());

			// if no focal point defined on the image - it's none of our business
			if (!file?.focal_point) {
				return getAssetInner.call(this, id, transformation, range);
			}

			let {width, height, transforms} = transformation?.transformationParams;

			// transforms can be null or undefined
			if (!transforms) {
				transforms = [];
			}

			transforms.forEach((config, i, transforms) => {
				if (config[0] === 'resize' && !('position' in config[1])) {
					transforms[i][1].position = file.focal_point;
				}
			});

			if (width || height) {
				transforms.push(['resize', {
					width: width ? Number(width) : undefined,
					height: height ? Number(height) : undefined,
					position: file.focal_point
				}]);

				transformation.transformationParams.transforms = transforms;
			}

			// logger.info(`Asset processed parameter: ${JSON.stringify(transformation)}`);

			return getAssetInner.call(this, id, transformation, range);
		};
	});
});
