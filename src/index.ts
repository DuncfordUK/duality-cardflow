import './styles/cardflow.scss';
import {
  registerSettings,
  mountPlayerArea,
  registerCardHooks,
  registerMacroBarToggle,
  exposeDebugAPI,
} from './module';

Hooks.once('init', () => {
  registerSettings();
  console.log('Duality Cardflow | Initialized');
});

Hooks.once('ready', () => {
  mountPlayerArea();
  registerCardHooks();
  registerMacroBarToggle();
  exposeDebugAPI();
  console.log('Duality Cardflow | Ready');
});
