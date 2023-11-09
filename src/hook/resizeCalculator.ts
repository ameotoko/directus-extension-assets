import { Region } from "sharp";
import Cropper from 'cropperjs';

type NumberTuple = [number, number];
type ImageDimensions = Pick<Region, 'width' | 'height'>;

export function fractionsToPixels(originalSize: ImageDimensions, importantPart: Cropper.SetDataOptions) {
  const imageWidth = originalSize.width;
  const imageHeight = originalSize.height;

  const left = Math.min(imageWidth - 1, Math.round(importantPart.x! * imageWidth));
  const top = Math.min(imageHeight - 1, Math.round(importantPart.y! * imageHeight));

  const width = Math.max(1, Math.min(imageWidth - left, Math.round(importantPart.width! * imageWidth)));
  const height = Math.max(1, Math.min(imageHeight - top, Math.round(importantPart.height! * imageHeight)));

  return { left, top, width, height };
}

/**
 * Calculates the resize coordinates for mode crop.
 *
 * @param size Target size
 * @param original Original image size
 * @param importantPart Important part of the image (result of `importantPartAsCoordinates` invocation)
 * @param zoom Zoom level
 */
export function calculateCrop(size: NumberTuple, original: ImageDimensions, importantPart: Region, zoom: number = 1) {
  // Calculate the image part for zoom 0
  const leastZoomed = calculateLeastZoomed(
    size,
    original,
    importantPart
  );

  // Calculate the image part for zoom 100
  let mostZoomed = calculateMostZoomed(
    size,
    original,
    importantPart
  );

  // If the most zoomed area is larger, no zooming can be applied
  if (mostZoomed['width'] > leastZoomed['width']) {
    mostZoomed = leastZoomed;
  }

  // Apply zoom
  const zoomedImportantPart = {} as Region;

  for (const key of ['left', 'top', 'width', 'height'] as const) {
    zoomedImportantPart[key] = (mostZoomed[key] * zoom) + (leastZoomed[key] * (1 - zoom))

  }

  const targetX = zoomedImportantPart.left * size[0] / zoomedImportantPart.width;
  const targetY = zoomedImportantPart.top * size[1] / zoomedImportantPart.height;
  const targetWidth = original.width * size[0] / zoomedImportantPart.width;
  const targetHeight = original.height * size[1] / zoomedImportantPart.height;

  return buildCoordinates([targetWidth, targetHeight], [targetX, targetY], size, original);
}

/**
 * Builds a resize coordinates object.
 */
function buildCoordinates(size: NumberTuple, cropStart: NumberTuple, cropSize: NumberTuple, original: ImageDimensions) {
  let scale = 1;

  // isRelative can be true only for SVG
  if (/*!original.isRelative() && */Math.round(size[0]) > original.width) {
    scale = original.width / size[0];
  }

  const resizeConfig: ImageDimensions = {
    width: Math.max(Math.round(size[0] * scale), 1),
    height: Math.max(Math.round(size[1] * scale), 1)
  };

  const cropConfig: Region = {
    left: Math.min(Math.round(cropStart[0] * scale), resizeConfig.width - 1),
    top: Math.min(Math.round(cropStart[1] * scale), resizeConfig.height - 1),
    width: Math.max(Math.round(cropSize[0] * scale), 1),
    height: Math.max(Math.round(cropSize[1] * scale), 1)
  };

  return { resizeConfig, cropConfig };
}

/**
 * Calculates the least zoomed crop possible.
 * @param size Target size
 * @param origSize Original size
 * @param part Important part
 */
function calculateLeastZoomed(size: NumberTuple, origSize: ImageDimensions, part: Region): Region {
  const zoomed: Region = {
    left: 0,
    top: 0,
    width: origSize.width,
    height: origSize.height,
  };

  if (origSize.height * size[0] / origSize.width <= size[1]) {
    zoomed.width = origSize.height * size[0] / size[1];

    if (zoomed.width > part.width) {
      zoomed.left = (origSize.width - zoomed.width)
        * part.left
        / (origSize.width - part.width)
      ;
    } else {
      zoomed.left = part.left + ((part.width - zoomed.width) / 2);
    }
  } else {
    zoomed.height = origSize.width * size[1] / size[0];

    if (zoomed.height > part.height) {
      zoomed.top = (origSize.height - zoomed.height)
        * part.top
        / (origSize.height - part.height)
      ;
    } else {
      zoomed.top = part.top + ((part.height - zoomed.height) / 2);
    }
  }

  return zoomed;
}

/**
 * Calculates the most zoomed crop possible.
 * @param size Target size
 * @param origSize Original size
 * @param part Important part
 */
function calculateMostZoomed(size: NumberTuple, origSize: ImageDimensions, part: Region): Region {
  const zoomed = part;

  if (part.height * size[0] / part.width <= size[1]) {
    zoomed.height = size[1] * part.width / size[0];

    if (origSize.height > part.height) {
      zoomed.top -= (zoomed.height - part.height)
        * part.top
        / (origSize.height - part.height)
      ;
    }
  } else {
    zoomed.width = size[0] * zoomed.height / size[1];

    if (origSize.width > part.width) {
      zoomed.left -= (zoomed.width - part.width)
        * part.left
        / (origSize.width - part.width)
      ;
    }
  }

  return zoomed;
}
