// Module declarations for packages without bundled TypeScript types

// mssql v11 ships no .d.ts — minimal ambient declaration for the SDK query route
declare module 'mssql' {
  export interface IResult<T = unknown> {
    recordset: T[];
    recordsets: T[][];
    rowsAffected: number[];
  }
  export class ConnectionPool {
    readonly connected: boolean;
    connect(): Promise<this>;
    request(): Request;
    close(): Promise<void>;
  }
  export class Request {
    query(sql: string): Promise<IResult>;
  }
  export function connect(config: unknown): Promise<ConnectionPool>;
}
