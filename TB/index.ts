import 'text-encoding';

// Polyfill TextDecoder to support 'latin1' (required by jsPDF and others)
// This patches the constructor to fallback to UTF-8 if latin1 is requested but not supported
const TextEncodingPolyfill = require('text-encoding');

Object.assign(global, {
    TextEncoder: TextEncodingPolyfill.TextEncoder,
    TextDecoder: TextEncodingPolyfill.TextDecoder,
});

// Extra safety: Proxy TextDecoder to catch specific 'latin1' issues if the polyfill fails
const OriginalTextDecoder = global.TextDecoder;
// @ts-ignore
global.TextDecoder = class WrappedTextDecoder extends OriginalTextDecoder {
    constructor(label: string, options: any) {
        if (label && label.toLowerCase() === 'latin1') {
            // Force ISO-8859-1 which is the standard name for latin1, or fallback to utf-8 if needed
            try {
                super('iso-8859-1', options);
            } catch (e) {
                console.warn('TextDecoder: latin1/iso-8859-1 not supported, falling back to utf-8');
                super('utf-8', options);
            }
        } else {
            super(label, options);
        }
    }
};

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
