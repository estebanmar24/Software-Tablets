import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import ViewShot from 'react-native-view-shot';

// Component to generate chart images for PDF on mobile
// This component renders charts off-screen and captures them as base64 images

const CHART_WIDTH = 350;
const CHART_HEIGHT = 220;

const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
        borderRadius: 16,
    },
    propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: '#007bff',
    },
    propsForLabels: {
        fontSize: 10,
    },
};

// Function to generate a bar chart image
export const generateBarChartImage = async (
    viewShotRef,
    labels,
    data,
    title,
    colors = null
) => {
    return new Promise((resolve) => {
        if (Platform.OS === 'web' || !viewShotRef?.current) {
            resolve(null);
            return;
        }

        // Give time for the chart to render
        setTimeout(async () => {
            try {
                const uri = await viewShotRef.current.capture();
                resolve(uri);
            } catch (error) {
                console.error('Error capturing chart:', error);
                resolve(null);
            }
        }, 500);
    });
};

// Bar Chart Component for capture
export const CaptureBarChart = React.forwardRef(({ labels, data, title, barColors }, ref) => {
    // Truncate labels to prevent overflow
    const truncatedLabels = labels.map(l =>
        typeof l === 'string' ? (l.length > 8 ? l.substring(0, 8) + '..' : l) : l
    );

    // Use custom colors or default
    const getBarColor = (opacity, index) => {
        if (barColors && barColors[index]) {
            // Parse hex color and apply opacity
            const hex = barColors[index].replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        return `rgba(65, 105, 225, ${opacity})`; // Default blue
    };

    const chartData = {
        labels: truncatedLabels,
        datasets: [{
            data: data.map(d => typeof d === 'number' ? d : parseFloat(d) || 0),
        }],
    };

    return (
        <ViewShot ref={ref} options={{ format: 'png', quality: 0.9 }}>
            <View style={styles.chartContainer}>
                <BarChart
                    data={chartData}
                    width={CHART_WIDTH}
                    height={CHART_HEIGHT}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1, index) => getBarColor(opacity, index),
                        fillShadowGradient: '#4169E1',
                        fillShadowGradientOpacity: 1,
                    }}
                    style={styles.chart}
                    fromZero
                    showValuesOnTopOfBars
                />
            </View>
        </ViewShot>
    );
});

// Line Chart Component for capture
export const CaptureLineChart = React.forwardRef(({ labels, data, title }, ref) => {
    // Truncate labels to prevent overflow
    const truncatedLabels = labels.map(l =>
        typeof l === 'string' ? (l.length > 6 ? l.substring(0, 6) : l) : l
    );

    const chartData = {
        labels: truncatedLabels,
        datasets: [{
            data: data.map(d => typeof d === 'number' ? d : parseFloat(d) || 0),
            color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
            strokeWidth: 2,
        }],
    };

    return (
        <ViewShot ref={ref} options={{ format: 'png', quality: 0.9 }}>
            <View style={styles.chartContainer}>
                <LineChart
                    data={chartData}
                    width={CHART_WIDTH}
                    height={CHART_HEIGHT}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
                    }}
                    style={styles.chart}
                    bezier
                    fromZero
                />
            </View>
        </ViewShot>
    );
});

const styles = StyleSheet.create({
    chartContainer: {
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 8,
    },
    chart: {
        borderRadius: 8,
    },
});

export default {
    CaptureBarChart,
    CaptureLineChart,
    generateBarChartImage,
};
