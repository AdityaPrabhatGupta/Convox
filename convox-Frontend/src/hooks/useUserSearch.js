import { useState, useEffect, useCallback } from "react";
import axiosInstance from "../services/axiosInstance.js";

const useUserSearch = () => {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await axiosInstance.get(
          `/api/users/search?keyword=${encodeURIComponent(keyword.trim())}`,
        );
        setResults(data);
      } catch {
        setError("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [keyword]);

  const clearSearch = useCallback(() => {
    setKeyword("");
    setResults([]);
    setError(null);
  }, []);

  return { keyword, setKeyword, results, loading, error, clearSearch };
};

export default useUserSearch;

