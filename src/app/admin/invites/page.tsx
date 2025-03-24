"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Invite {
  id: string;
  email: string;
  code: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  } | null;
}

export default function AdminInvitesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      const response = await fetch("/api/admin/invites");
      if (!response.ok) {
        throw new Error("Failed to fetch invites");
      }
      const data = await response.json();
      setInvites(data);
    } catch (err) {
      console.error("Error fetching invites:", err);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  // Redirect if not authenticated
  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invite");
      }

      setSuccess(`Invite sent to ${email}`);
      setEmail("");
      fetchInvites(); // Refresh the invites list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Invites</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="user@example.com"
            required
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 bg-blue-600 text-white rounded-md ${
            isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
        >
          {isLoading ? "Sending..." : "Send Invite"}
        </button>
      </form>

      <div>
        <h2 className="text-xl font-semibold mb-4">Existing Invites</h2>
        {isLoadingInvites ? (
          <div>Loading invites...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered User
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {invite.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          invite.used
                            ? "bg-green-100 text-green-800"
                            : new Date(invite.expiresAt) < new Date()
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {invite.used
                          ? "Used"
                          : new Date(invite.expiresAt) < new Date()
                          ? "Expired"
                          : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {invite.user?.name || invite.user?.email || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
