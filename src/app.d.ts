declare global {
  namespace App {
    interface Error {
      message: string;
      incidentId?: string;
    }
  }
}

export {};
