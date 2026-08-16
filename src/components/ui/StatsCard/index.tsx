import {Card, CardContent} from "@/components/ui/Card";
import {LucideIcon} from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    description?: string;
}

export function StatsCard({title, value, icon: Icon, trend, description}: StatsCardProps) {
    return (
        <Card className="bg-card text-gray-600 border-border/50 hover:shadow-md transition-all">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold mt-2">{value}</p>

                        {trend && (
                            <div className="flex items-center mt-2">
                <span className={`text-xs font-medium ${
                    trend.isPositive ? "text-success" : "text-destructive"
                }`}>
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </span>
                                <span className="text-xs text-muted-foreground ml-1">vs previous month</span>
                            </div>
                        )}

                        {description && (
                            <p className="text-xs text-muted-foreground mt-1">{description}</p>
                        )}
                    </div>

                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-third rounded-lg flex items-center justify-center ml-4">
                        <Icon className="w-6 h-6 text-white"/>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}