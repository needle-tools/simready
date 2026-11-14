/** Bound embedded-image Blob lifetimes while Three loads a SimReady asset.
 * Large atlases can otherwise exceed the browser's Blob memory quota even
 * when the decoded preview images are small.
 * @param {object} parser
 */
export function limitImageRequests(parser: object): void;
