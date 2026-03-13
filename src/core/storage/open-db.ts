import { unlinkSync } from "node:fs"

import { BeaconDatabase } from "./db"

export function openDatabase(dbPath: string, dimensions: number): BeaconDatabase {
  try {
    return new BeaconDatabase(dbPath, dimensions)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("database disk image is malformed") || message.includes("file is not a database")) {
      try {
        unlinkSync(dbPath)
      } catch {
        // Ignore.
      }
      try {
        unlinkSync(`${dbPath}-wal`)
      } catch {
        // Ignore.
      }
      try {
        unlinkSync(`${dbPath}-shm`)
      } catch {
        // Ignore.
      }
      return new BeaconDatabase(dbPath, dimensions)
    }
    throw error
  }
}
