import { defineInterface } from '@directus/extensions-sdk';
import ImportantPart from './interface.vue';

export default defineInterface({
  id: 'ameotoko-important-part',
  name: 'Important part',
  icon: 'box',
  description: 'Allows to define an image area that will be preserved when cropping',
  component: ImportantPart,
  options: null,
  types: ['json'],
});
