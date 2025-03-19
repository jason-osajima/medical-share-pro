import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function NavBar() {
  const { logoutMutation } = useAuth();

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="text-xl font-semibold text-gray-900">MedDocs</a>
            </Link>
            
            <div className="hidden md:flex items-center gap-4">
              <Link href="/">
                <a className="text-gray-600 hover:text-gray-900">Dashboard</a>
              </Link>
              <Link href="/timeline">
                <a className="text-gray-600 hover:text-gray-900">Timeline</a>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search..."
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
