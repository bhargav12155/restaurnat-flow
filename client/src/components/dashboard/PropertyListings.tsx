import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MapPin, DollarSign, Bed, Bath, Square } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Property } from "@shared/schema";

export default function PropertyListings() {
  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 border rounded-lg">
                <div className="w-16 h-16 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sold':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPropertyImage = (neighborhood: string) => {
    const images = {
      'Benson': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=80',
      'Dundee': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=80',
      'West Omaha': 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=80',
      default: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=80'
    };
    
    return images[neighborhood as keyof typeof images] || images.default;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Properties</CardTitle>
          <Button variant="ghost" className="text-primary hover:text-primary/80">
            View All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {properties?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No properties found. Add your first property to get started!</p>
              <Button className="mt-4">Add Property</Button>
            </div>
          ) : (
            properties?.map((property) => (
              <div
                key={property.id}
                className="flex items-center space-x-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <img
                  src={property.imageUrl || getPropertyImage(property.neighborhood)}
                  alt={property.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{property.title}</h4>
                  <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-3">
                    <span className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {property.neighborhood}
                    </span>
                    <span className="flex items-center">
                      <Bed className="w-3 h-3 mr-1" />
                      {property.bedrooms}BR
                    </span>
                    <span className="flex items-center">
                      <Bath className="w-3 h-3 mr-1" />
                      {property.bathrooms}BA
                    </span>
                    <span className="flex items-center">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {Number(property.price).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getStatusColor(property.status)} variant="secondary">
                      {property.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(Math.random() * 30) + 1} days on market
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground flex items-center">
                    <Eye className="w-3 h-3 mr-1" />
                    {Math.floor(Math.random() * 50) + 5} views
                  </p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
