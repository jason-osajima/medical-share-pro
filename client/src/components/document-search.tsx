import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchFilters {
  query: string;
  category: string;
  tags: string[];
  startDate: Date | null;
  endDate: Date | null;
}

interface DocumentSearchProps {
  onSearch: (filters: SearchFilters) => void;
  categories: string[];
}

export default function DocumentSearch({ onSearch, categories }: DocumentSearchProps) {
  const [currentTag, setCurrentTag] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    category: "all",
    tags: [],
    startDate: null,
    endDate: null,
  });

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      const newTags = [...filters.tags, currentTag.trim()];
      setFilters(prev => ({ ...prev, tags: newTags }));
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = filters.tags.filter(tag => tag !== tagToRemove);
    setFilters(prev => ({ ...prev, tags: newTags }));
  };

  const handleSearch = () => {
    console.log('Search triggered with filters:', filters);
    onSearch({
      ...filters,
      category: filters.category === "all" ? "" : filters.category,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Search Documents</Label>
        <Input
          placeholder="Search by name or content..."
          value={filters.query}
          onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={filters.category}
          onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <Input
          value={currentTag}
          onChange={(e) => setCurrentTag(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder="Type a tag and press Enter"
        />
        {filters.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {filters.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? format(filters.startDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.startDate}
                onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? format(filters.endDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.endDate}
                onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button 
        className="w-full" 
        onClick={handleSearch}
      >
        <Search className="w-4 h-4 mr-2" />
        Search Documents
      </Button>
    </div>
  );
}