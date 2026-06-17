import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListCategories, useUpdateCategory, useDeleteCategory, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Library, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const handleToggleActive = (id: number, active: boolean) => {
    updateCategory.mutate(
      { id, data: { active } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Status updated" });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    deleteCategory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Category deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete category", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Library className="w-8 h-8 text-primary" />
          Categories
        </h1>
        <Button onClick={() => setLocation("/categories/new")} className="gap-2">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !categories?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No categories found.
            </div>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg text-2xl">
                      {cat.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Label: {cat.label} • Type: {cat.type} • Order: {cat.sortOrder}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Switch
                        checked={cat.active}
                        onCheckedChange={(checked) => handleToggleActive(cat.id, checked)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setLocation(`/categories/${cat.id}`)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
