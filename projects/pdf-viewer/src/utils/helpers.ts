export function assign(object: any, property: string, value: any) {
  if (Object.isExtensible(object)) {
    object[property] = value;
  }
}

export function isSSR() {
  return globalThis.window === undefined;
}
