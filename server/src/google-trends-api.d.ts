declare module 'google-trends-api' {
  interface InterestOptions {
    keyword: [string, string];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }

  export function interestOverTime(options: InterestOptions): Promise<string>;
}
