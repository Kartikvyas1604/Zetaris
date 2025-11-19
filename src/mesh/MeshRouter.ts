/**
 * Mesh Network Router
 * Handles message routing and discovery in the mesh network
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface Route {
  destination: string;
  nextHop: string;
  hopCount: number;
  lastUpdated: number;
}

export interface RoutingTable {
  routes: Map<string, Route>;
}

export class MeshRouter extends EventEmitter {
  private routingTable: Map<string, Route>;
  private localPeerId: string;
  private maxHops: number;
  private routeTimeout: number;

  constructor(localPeerId: string, maxHops: number = 10) {
    super();
    this.localPeerId = localPeerId;
    this.maxHops = maxHops;
    this.routeTimeout = 300000; // 5 minutes
    this.routingTable = new Map();
  }

  /**
   * Add or update a route
   */
  addRoute(destination: string, nextHop: string, hopCount: number): void {
    const existing = this.routingTable.get(destination);

    // Only update if new route is better or doesn't exist
    if (!existing || hopCount < existing.hopCount) {
      this.routingTable.set(destination, {
        destination,
        nextHop,
        hopCount,
        lastUpdated: Date.now(),
      });

      this.emit('route:added', { destination, nextHop, hopCount });
    }
  }

  /**
   * Remove a route
   */
  removeRoute(destination: string): void {
    if (this.routingTable.delete(destination)) {
      this.emit('route:removed', { destination });
    }
  }

  /**
   * Find next hop for a destination
   */
  findNextHop(destination: string): string | null {
    const route = this.routingTable.get(destination);
    
    if (!route) {
      return null;
    }

    // Check if route is expired
    if (Date.now() - route.lastUpdated > this.routeTimeout) {
      this.removeRoute(destination);
      return null;
    }

    return route.nextHop;
  }

  /**
   * Get all routes
   */
  getRoutes(): Route[] {
    return Array.from(this.routingTable.values());
  }

  /**
   * Get route to specific destination
   */
  getRoute(destination: string): Route | undefined {
    return this.routingTable.get(destination);
  }

  /**
   * Clear expired routes
   */
  cleanupRoutes(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [dest, route] of this.routingTable.entries()) {
      if (now - route.lastUpdated > this.routeTimeout) {
        expired.push(dest);
      }
    }

    for (const dest of expired) {
      this.removeRoute(dest);
    }

    if (expired.length > 0) {
      this.emit('routes:cleaned', { count: expired.length });
    }
  }

  /**
   * Update routing table from a routing announcement
   */
  updateFromAnnouncement(from: string, routes: Array<{ destination: string; hopCount: number }>): void {
    for (const { destination, hopCount } of routes) {
      // Don't route to ourselves
      if (destination === this.localPeerId) {
        continue;
      }

      // Check hop limit
      if (hopCount + 1 > this.maxHops) {
        continue;
      }

      this.addRoute(destination, from, hopCount + 1);
    }
  }

  /**
   * Generate routing announcement for neighbors
   */
  generateAnnouncement(): Array<{ destination: string; hopCount: number }> {
    const routes: Array<{ destination: string; hopCount: number }> = [];

    // Include ourselves
    routes.push({
      destination: this.localPeerId,
      hopCount: 0,
    });

    // Include known routes
    for (const route of this.routingTable.values()) {
      routes.push({
        destination: route.destination,
        hopCount: route.hopCount,
      });
    }

    return routes;
  }

  /**
   * Check if we can reach a destination
   */
  canReach(destination: string): boolean {
    return this.routingTable.has(destination);
  }

  /**
   * Get routing table size
   */
  getTableSize(): number {
    return this.routingTable.size;
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routingTable.clear();
    this.emit('routes:cleared');
  }
}

export default MeshRouter;
