import { useState, useEffect, useCallback } from "react";
import { getClinicInventory } from "@/lib/server-functions/inventory";
import type ClinicInventory from "@/models/clinic-inventory";
import { useDebounceValue } from "usehooks-ts";

export interface InventoryItem extends ClinicInventory.DrugWithBatchInfo {
  // Additional properties if needed can be added here
}

export type UseClinicInventoryReturn = {
  items: InventoryItem[];
  loading: boolean;
  error: string | null;
  setClinicId: (clinicId: string) => void;
  setSearchQuery: (query: string) => void;
  refetch: () => Promise<void>;
};

export function useClinicInventory(): UseClinicInventoryReturn {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useDebounceValue<string>("", 1000);

  const fetchInventory = useCallback(async () => {
    if (!clinicId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getClinicInventory({
        data: {
          clinicId,
          searchQuery,
          limit: 1000, // Set a high limit to get all items
          offset: 0,
        },
      });

      if (result && result.items) {
        // The items already include generic_name and brand_name from the catalogue
        setItems(result.items);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Error fetching clinic inventory:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch inventory",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, searchQuery]);

  // Fetch inventory when clinicId or searchQuery changes
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleSetClinicId = useCallback((newClinicId: string) => {
    setClinicId(newClinicId);
  }, []);

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return {
    items,
    loading,
    error,
    setClinicId: handleSetClinicId,
    setSearchQuery: handleSetSearchQuery,
    refetch: fetchInventory,
  };
}
