declare module 'zipcodes-ph' {
  const zipcodes: {
    find: (zipcode: number | string) => string | string[] | null
    reverse: (location: string) => number | null
  }

  export default zipcodes
}
