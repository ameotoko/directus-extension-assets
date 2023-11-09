import { defineHook } from '@directus/extensions-sdk';
import { File } from '@directus/types';
import { TransformationSet } from '@directus/api/dist/types';
import { AssetsService } from '@directus/api/services';
import { Range } from '@directus/storage';
import { updateDatabase } from './database.js';
import clone from 'clone';
import { ResizeOptions } from 'sharp';
import { calculateCrop, fractionsToPixels } from './resizeCalculator';

export default defineHook(({ init }, context) => {
	init('app.before', () => {
		updateDatabase(context);
	});

	init('app.after', () => {
		const { services, logger, env } = context;
		const assets: AssetsService = services.AssetsService;

    const dev = env.NODE_ENV === 'development';

		/*
		 * Directus does not provide extension points for hooking into AssetsService,
		 * so we decorate it instead.
		 */
		const getAssetInner = assets.prototype.getAsset;

    /**
     * Our task is to override `transformation.transformationParams.transforms`, which is a sequence of Sharp method calls.
     *
     * @param id              File UUID
     * @param transformation  Object with `transformationParams` property whose keys are allowed URL query params
     *                        (see https://docs.directus.io/reference/files.html#custom-transformations).
     *                        Each query param will be expanded into Sharp's method later by inner service.
     * @param range
     */
		assets.prototype.getAsset = async function (id: string, transformation?: TransformationSet, range?: Range) {
      const bypass = (message: string) => {
        dev && logger.info(`[extension-assets] ${message}`);

        return getAssetInner.call(this, id, transformation, range);
      }

      if (!transformation) {
				return bypass('No transformation requested, bypassing');
      }

			dev && logger.info(`[extension-assets] requested transformation: ${JSON.stringify(transformation)}`);

      const file: File & { important_part: string } | undefined = (
        await this.knex
          .select('*')
          .from('directus_files')
          .where({ id })
          .first()
      );

      if (!file) {
				return bypass('File not found, bypassing');
      }

			if (file.important_part === null) {
				return bypass('Important part is not defined, bypassing');
			}

			/*
			 * Clone the parameter to break the reference to SYSTEM_ASSET_ALLOW_LIST,
			 * otherwise SYSTEM_ASSET_ALLOW_LIST gets updated, which affects all the
			 * subsequent transformations, until server is restarted.
			 */
			const transformationProcessed = clone(transformation);

			const { width, height, transforms = [] } = transformationProcessed.transformationParams;
      const resizeTransform = transforms.find(config => config[0] === 'resize');

      if (!width && !height && !resizeTransform) {
        return bypass('Transformation set does not include resizing, bypassing');
      }

      let cropWidth: number = 0,
        cropHeight: number = 0;

      if (resizeTransform) {
        // if resize in `transforms` - take width and height from there
        const resizeParams: ResizeOptions = resizeTransform[1];

        if (resizeParams.width && resizeParams.height) {
          cropWidth = resizeParams.width;
          cropHeight = resizeParams.height;
        }
      }

      // query parameters override transform settings
      if (width && height) {
        cropWidth = width;
        cropHeight = height;
      }

      if (!cropWidth || !cropHeight) {
        return bypass('Both "width" and "height" must be explicitly provided to use important part.');
      }

      // get values and remove width and height
      const importantPart = fractionsToPixels(
        { width: file.width!, height: file.height! },
        JSON.parse(file.important_part)
      );

      const { resizeConfig, cropConfig } = calculateCrop(
        [cropWidth, cropHeight],
        { width: file.width!, height: file.height! },
        importantPart
      );

      transforms.push(['resize', resizeConfig], ['extract', cropConfig]);

      transformationProcessed.transformationParams.transforms = transforms;

			dev && logger.info(`[extension-assets] processed transformation: ${JSON.stringify(transformationProcessed)}`);

			return getAssetInner.call(this, id, transformationProcessed, range);
		};
	});
});
