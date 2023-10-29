import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ init }, { services: { AssetsService } }) => {
	init('app.after', () => {
		const getAssetInner = AssetsService.prototype.getAsset;

		AssetsService.prototype.getAsset = async function (id, transformation, range) {
			const file = (await this.knex.select('*').from('directus_files').where({ id }).first());
			const {width, height, transforms = []} = transformation?.transformationParams;

			if (file?.focal_point && (width || height)) {
				transforms.push(['resize', {
					width: width ? Number(width) : undefined,
					height: height ? Number(height) : undefined,
					position: file.focal_point
				}]);

				transformation.transformationParams.transforms = transforms;
			}

			return getAssetInner.call(this, id, transformation, range);
		};
	});
});
